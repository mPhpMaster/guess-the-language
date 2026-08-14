import { fetchTopScores, sbFetch, supabaseConfigured } from './api.js';
import { $, announce, closeDialog, openDialog } from './dom.js';
import { getLang, t } from './i18n.js';
import { canPlay, getDiscordDisplayName, getDiscordProfile, getSettings, isDiscordActivity, isDiscordLinked, isSafePlayerName, requiresDiscordLogin, sanitizeName, startDiscordLogin, syncDiscordNameField, updateDiscordLoginButton, updateHomeProfile } from './identity.js';
import { refreshMultiplayerButtons } from './mp-ui.js';
import { canPublishPresence, pushPresence } from './presence.js';
import { defaultSettings, state, store } from './state.js';
import { getUiScale } from './ui-scale.js';

export function applySettingsToUI() {
    const s = getSettings();
    $('#set-language').value = getLang();
    const scaleLabel = $('#ui-scale-value');
    if (scaleLabel) scaleLabel.textContent = Math.round(getUiScale() * 100) + '%';
    if (!isDiscordActivity()) {
        $('#set-name').value = s.name || '';
    }
    $('#set-questions').value = String(s.questions);
    $('#set-sound').checked = !!s.sound;
    const adaptiveEl = $('#set-adaptive'); if (adaptiveEl) adaptiveEl.checked = !!s.adaptive;
    $('#set-difficulty').value = s.difficulty;
    $('#set-timer').value = String(s.timer || 'auto');
    $('#set-feedback-delay').value = String(s.feedbackDelay ?? 4);
    const presenceRow = $('#setting-presence-row');
    if (presenceRow) {
        // Only meaningful inside Discord with the rich-presence scope granted.
        presenceRow.classList.toggle('hidden', !canPublishPresence());
        $('#set-presence').checked = s.discordPresence !== false;
    }
    const webIdentity = requiresDiscordLogin();
    $('#setting-name-row')?.classList.toggle('hidden', webIdentity);
    $('#discord-name-note')?.classList.toggle('hidden', !webIdentity);
    $('#settings-error')?.classList.add('hidden');
    syncDiscordNameField();
    updateDiscordLoginButton();
    updateHomeProfile();
    updateStartButtonState();
}

export function saveSettingsFromUI() {
    // Guard against an empty / non-option #set-questions value writing a
    // 0-question round: fall back to the current or default question count.
    const q = Number($('#set-questions').value);
    const timerRaw = $('#set-timer') ? $('#set-timer').value : 'auto';
    const feedbackRaw = $('#set-feedback-delay')?.value || '4';
    store.settings = {
        name: isDiscordLinked()
            ? (getSettings().name || '')
            : sanitizeName($('#set-name').value),
        questions: q > 0 ? q : (getSettings().questions || defaultSettings.questions),
        sound: $('#set-sound').checked,
        adaptive: $('#set-adaptive') ? $('#set-adaptive').checked : (getSettings().adaptive === true),
        difficulty: $('#set-difficulty').value,
        timer: timerRaw === 'auto' ? 'auto' : (Number(timerRaw) || 'auto'),
        feedbackDelay: feedbackRaw === 'manual' ? 'manual' : ([2, 4, 6].includes(Number(feedbackRaw)) ? Number(feedbackRaw) : 4),
        discordPresence: $('#set-presence') ? $('#set-presence').checked : (getSettings().discordPresence !== false)
    };
    updateStartButtonState();
    // Turning the toggle off must take the card down immediately, not at the next
    // question.
    pushPresence();
}

export function getPlayerNameInputValue() {
    if (isDiscordActivity()) {
        return getDiscordDisplayName() || '';
    }
    const raw = $('#set-name')?.value ?? getSettings().name ?? '';
    return String(raw).trim().slice(0, 24);
}

// Player name used on the leaderboard. Defaults to "User".
export function getPlayerName() {
    const profile = getDiscordProfile();
    if (profile?.name) {
        return isSafePlayerName(profile.name) ? sanitizeName(profile.name) : `Player ${String(profile.id || '').slice(-4) || 'User'}`;
    }
    const name = getPlayerNameInputValue();
    return name || 'User';
}

export function openSettingsPanel() {
    closeDialog($('#about-panel'), false);
    applySettingsToUI();
    const nameInput = $('#set-name');
    openDialog($('#settings-panel'), nameInput && !nameInput.disabled ? nameInput : $('#set-language'));
    if (nameInput && !nameInput.disabled) nameInput.select();
}

export async function ensureValidPlayerName() {
    const previousName = getSettings().name ? getSettings().name.trim().toLowerCase() : '';
    saveSettingsFromUI();
    if (isDiscordLinked()) {
        return { valid: true, name: getPlayerName() };
    }

    const candidate = getPlayerNameInputValue();
    if (!candidate) {
        openSettingsPanel();
        return { valid: false, name: '', message: t('nameRequired') };
    }

    if (!isSafePlayerName(candidate)) {
        openSettingsPanel();
        $('#set-name')?.setAttribute('aria-invalid', 'true');
        const error = $('#settings-error');
        if (error) {
            error.textContent = t('unsafeName');
            error.classList.remove('hidden');
        }
        return { valid: false, name: '', message: t('unsafeName') };
    }

    const lower = candidate.toLowerCase();
    const isReturningName = lower && previousName && lower === previousName;

    if (supabaseConfigured() && !isReturningName) {
        try {
            const safety = await sbFetch('rpc/is_safe_player_name', {
                method: 'POST',
                body: JSON.stringify({ p_name: candidate })
            });
            if (safety !== true) {
                openSettingsPanel();
                return { valid: false, name: '', message: t('unsafeName') };
            }
            const top = await fetchTopScores(100);
            const hasOnlineDuplicate = (top || []).some((r) => String(r.player || '').trim().toLowerCase() === lower);
            if (hasOnlineDuplicate) {
                openSettingsPanel();
                return { valid: false, name: '', message: t('nameTaken') };
            }
        } catch (e) {
            console.warn('Unable to verify leaderboard name availability:', e);
        }
    }

    return { valid: true, name: candidate };
}

export function updateStartButtonState() {
    const startBtn = $('#btn-start');
    if (startBtn) {
        const hasQuestions = Array.isArray(state.allQuestions) && state.allQuestions.length > 0;
        const needsLogin = requiresDiscordLogin() && !isDiscordLinked();
        startBtn.disabled = needsLogin ? false : !(hasQuestions && canPlay());
        startBtn.dataset.authAction = needsLogin ? 'true' : 'false';
        startBtn.setAttribute('data-i18n', needsLogin ? 'loginDiscordToPlay' : 'start');
        startBtn.textContent = t(needsLogin ? 'loginDiscordToPlay' : 'start');
    }
    // Host / Join follow the same gate.
    refreshMultiplayerButtons();
}

// Gate before starting/hosting/joining. On the web build that means signing in
// with Discord (we kick off the flow); elsewhere it means having a name.
export function requireNameToInteract() {
    if (canPlay()) return true;
    if (requiresDiscordLogin()) {
        startDiscordLogin();
        return false;
    }
    openSettingsPanel();
    const error = $('#settings-error');
    if (error) {
        error.textContent = t('nameRequired');
        error.classList.remove('hidden');
    }
    announce(t('nameRequired'));
    return false;
}
