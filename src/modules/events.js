import { closeAdminPanel, requestAdminAccess } from './admin.js';
import { $, closeDialog, openDialog, showScreen } from './dom.js';
import { advanceAfterFeedback, clearTimer, endQuiz, onGameKeydown, showCodeTab, startGame, startPractice, submitFill, useFifty } from './game.js';
import { renderHome } from './home.js';
import { MODES, t } from './i18n.js';
import { discordAvatarUrl, discordLogout, getDiscordProfile, startDiscordLogin } from './identity.js';
import { buildResultsLeaderboard, challengeFriend, flashButton, hideChallengeBanner, submitLeaderboardReport, updateLbScopeSwitch } from './leaderboard.js';
import { closeJoinModal, confirmJoinRoom, enterDiscordLobby, hostRoomFlow, inviteFromLobby, invitePlayersToRoom, leaveMultiplayer, lobbyStartGame, mpPlayAgain, openJoinModal, pushLobbySettings } from './mp-ui.js';
import { pushPresence } from './presence.js';
import { handleDiscordActivityJoin, openProfileCard, refreshPlayerCard, setPlayerCardId } from './profile.js';
import { endGame, shareResultCard } from './results.js';
import { isDailyDone, startDailyChallenge } from './round.js';
import { applySettingsToUI, getPlayerName, openSettingsPanel, saveSettingsFromUI, updateStartButtonState } from './settings.js';
import { state, store } from './state.js';
import { UI_SCALE_STEP, nudgeUiScale } from './ui-scale.js';

// ============================================================
//  Wire up the UI
// ============================================================
export function bindEvents() {
    // window controls
    $('#tb-min').addEventListener('click', () => window.appWindow ?.minimize());
    $('#tb-max').addEventListener('click', () => window.appWindow ?.toggleMaximize());
    $('#tb-close').addEventListener('click', () => window.appWindow ?.close());

    // Leave the room if the player closes the window, refreshes, or navigates
    // away — a keepalive beacon still flushes while the renderer is unloading.
    const leaveOnUnload = () => {
        try {
            window.GTL_MULTIPLAYER.leaveBeacon();
        } catch (e) {
            /* unloading */ }
    };
    window.addEventListener('pagehide', leaveOnUnload);
    window.addEventListener('beforeunload', leaveOnUnload);

    // mode cards — select in place (stay on the home page)
    document.querySelectorAll('#mode-grid .mode-card').forEach((card) => {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    });

    // home actions
    $('#btn-start').addEventListener('click', () => startGame());
    $('#btn-host').addEventListener('click', hostRoomFlow);
    $('#btn-discord-host').addEventListener('click', enterDiscordLobby);
    $('#btn-join').addEventListener('click', openJoinModal);
    $('#btn-join-confirm').addEventListener('click', confirmJoinRoom);
    $('#btn-join-cancel').addEventListener('click', closeJoinModal);
    $('#join-code').addEventListener('input', (e) => {
        e.target.value = window.GTL_MULTIPLAYER.normalizeCode(e.target.value);
    });
    $('#btn-copy-code').addEventListener('click', () => {
        const code = $('#lobby-code').textContent;
        navigator.clipboard ?.writeText(code).then(
            () => flashButton('#btn-copy-code', t('codeCopied')),
            () => {}
        );
    });
    $('#btn-lobby-start').addEventListener('click', lobbyStartGame);
    // Host-only lobby settings (mode / questions / difficulty push to the room;
    // sound is a per-client preference).
    $('#lobby-mode-select').addEventListener('change', pushLobbySettings);
    $('#lobby-questions').addEventListener('change', pushLobbySettings);
    $('#lobby-difficulty').addEventListener('change', pushLobbySettings);
    $('#lobby-timer').addEventListener('change', pushLobbySettings);
    $('#lobby-sound').addEventListener('change', () => {
        const cur = store.settings;
        cur.sound = $('#lobby-sound').checked;
        store.settings = cur;
    });
    $('#btn-lobby-end').addEventListener('click', () => {
        if (window.GTL_MULTIPLAYER.state.room ?.status === 'lobby') {
            leaveMultiplayer();
        } else {
            window.GTL_MULTIPLAYER.endRoom().catch((e) => console.error(e));
        }
    });
    $('#btn-lobby-leave').addEventListener('click', leaveMultiplayer);
    $('#btn-lobby-invite').addEventListener('click', inviteFromLobby);
    $('#ui-scale-minus')?.addEventListener('click', () => nudgeUiScale(-UI_SCALE_STEP));
    $('#ui-scale-plus')?.addEventListener('click', () => nudgeUiScale(UI_SCALE_STEP));
    $('#lb-mode-select')?.addEventListener('change', (e) => {
        state.lbViewMode = e.target.value;
        buildResultsLeaderboard();
    });
    $('#lb-scope-switch')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.lb-scope-btn');
        if (!btn) return;
        state.lbScope = btn.dataset.scope === 'week' ? 'week' : 'all';
        updateLbScopeSwitch();
        buildResultsLeaderboard();
    });
    // Click your name/avatar on Home to open your own profile (rank per mode).
    const homeProfile = $('#home-profile');
    if (homeProfile) {
        homeProfile.classList.add('is-clickable');
        homeProfile.tabIndex = 0;
        homeProfile.setAttribute('role', 'button');
        const openSelf = () => openProfileCard({ name: getPlayerName(), avatar: discordAvatarUrl(getDiscordProfile()) || undefined, you: true });
        homeProfile.addEventListener('click', openSelf);
        homeProfile.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            openSelf();
        });
    }
    $('#btn-friends').addEventListener('click', viewLeaderboard);
    $('#btn-daily')?.addEventListener('click', () => {
        // Already played today → just show today's board; otherwise start the challenge.
        if (isDailyDone()) viewDailyResults();
        else startDailyChallenge();
    });
    $('#btn-settings').addEventListener('click', openSettingsPanel);
    // Passcode gate first — requestAdminAccess() only opens the panel after the
    // server has accepted the passcode and issued an unlock token.
    $('#btn-admin')?.addEventListener('click', requestAdminAccess);
    $('#admin-close')?.addEventListener('click', closeAdminPanel);
    $('#admin-modal')?.addEventListener('click', (e) => { if (e.target === $('#admin-modal')) closeAdminPanel(); });
    $('#set-close').addEventListener('click', () => {
        saveSettingsFromUI();
        closeDialog($('#settings-panel'));
        // Repaint the home screen so the new round settings (best score, mode
        // buttons) are reflected right away.
        renderHome();
    });
    $('#set-name').addEventListener('input', () => {
        $('#set-name').removeAttribute('aria-invalid');
        $('#settings-error').classList.add('hidden');
        updateStartButtonState();
    });
    $('#btn-discord-login')?.addEventListener('click', startDiscordLogin);
    $('#btn-discord-logout')?.addEventListener('click', discordLogout);
    $('#home-login-cta')?.addEventListener('click', startDiscordLogin);
    $('#auth-retry')?.addEventListener('click', startDiscordLogin);

    // about
    $('#btn-about').addEventListener('click', () => {
        closeDialog($('#settings-panel'), false);
        openAbout();
    });
    $('#about-close').addEventListener('click', () => closeDialog($('#about-panel')));
    document.querySelectorAll('.about-link, .about-legal-link').forEach((b) => {
        b.addEventListener('click', (event) => {
            event.preventDefault();
            // Buttons carry data-url; the legal <a> links carry an href (already
            // resolved to an absolute URL by the browser).
            openExternalUrl(b.dataset.url || b.href);
        });
    });

    // game — end the quiz early
    $('#btn-end').addEventListener('click', () => openDialog($('#end-dialog'), $('#btn-end-cancel')));
    $('#btn-end-confirm').addEventListener('click', () => {
        closeDialog($('#end-dialog'));
        endQuiz();
    });
    $('#btn-end-cancel').addEventListener('click', () => closeDialog($('#end-dialog')));
    // Spectator's own exit — leave the room and return home immediately.
    $('#btn-mp-leave')?.addEventListener('click', () => leaveMultiplayer());
    $('#btn-next').addEventListener('click', advanceAfterFeedback);
    $('#btn-fifty')?.addEventListener('click', useFifty);
    // Code panel tabs: the snippet, and the hint that masks the answer out.
    $('#code-tab')?.addEventListener('click', () => showCodeTab('snippet'));
    $('#code-tab-hint')?.addEventListener('click', () => showCodeTab('hint'));

    // Desktop: answer with number keys (1–4) or letters (a–d) while a choice
    // question is open. Typing into the fill-in box is never intercepted, and
    // Enter on the focused "Next" button keeps its native behaviour.
    document.addEventListener('keydown', onGameKeydown);

    // fill-in-the-blank answer (submit button + Enter both submit the form)
    $('#fill-form').addEventListener('submit', (e) => {
        e.preventDefault();
        submitFill();
    });

    $('#report-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.submitter?.value === 'cancel') closeDialog($('#report-dialog'));
        else submitLeaderboardReport();
    });

    // Player card (opened by clicking a row in the lobby / in-game player list).
    $('#btn-player-card-close')?.addEventListener('click', () => closeDialog($('#player-card')));
    $('#btn-player-card-invite')?.addEventListener('click', invitePlayersToRoom);
    // Covers every close path (button, Esc, backdrop) so live refreshes stop.
    $('#player-card')?.addEventListener('close', () => { setPlayerCardId(null); });

    // "Show my game on Discord" — apply the moment it's toggled rather than on save.
    $('#set-presence')?.addEventListener('change', () => {
        const cur = store.settings;
        cur.discordPresence = $('#set-presence').checked;
        store.settings = cur;
        pushPresence();
    });

    // A member pressed "Ask to Join" on this game's Discord profile card.
    window.addEventListener('discord-activity-join', (e) => {
        handleDiscordActivityJoin(e.detail?.secret);
    });
    // Connected-participant list changed → an open card may gain a real avatar.
    window.addEventListener('discord-participants', () => refreshPlayerCard());

    [$('#settings-panel'), $('#about-panel'), $('#join-modal'), $('#end-dialog'), $('#report-dialog'), $('#player-card')].forEach((dialog) => {
        if (!dialog) return;
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            if (dialog === $('#settings-panel')) applySettingsToUI();
            closeDialog(dialog);
        });
        // Light dismiss, measured against the visible box rather than the event
        // target. `.modal` dialogs fill the viewport and paint their content in
        // an inner .modal-card, but a `.popover` IS the box — so `target ===
        // dialog` closed About and Settings on any click that landed on their
        // own padding or between two children.
        dialog.addEventListener('click', (e) => {
            // A keyboard-activated button fires a click at (0, 0); that is not a
            // click on the backdrop.
            if (e.detail === 0) return;
            const box = dialog.querySelector('.modal-card') || dialog;
            const r = box.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom;
            if (inside) return;
            if (dialog === $('#settings-panel')) applySettingsToUI();
            closeDialog(dialog);
        });
    });

    // results
    $('#btn-challenge').addEventListener('click', challengeFriend);
    $('#btn-replay').addEventListener('click', () => {
        if (state.multiplayer) mpPlayAgain(); // back to the lobby
        else if (state.daily) startDailyChallenge(); // same set; only the first score counts
        else if (state.learn) startPractice();
        else startGame();
    });
    $('#btn-practice')?.addEventListener('click', startPractice);
    $('#btn-share-card')?.addEventListener('click', shareResultCard);
    $('#btn-menu').addEventListener('click', () => {
        if (state.multiplayer) {
            leaveMultiplayer(); // leave the room -> main menu
        } else {
            showScreen('home');
            renderHome();
        }
    });

}

export function refreshMenu() {
    $('#menu-highscore-val').textContent = String(store.highScore(state.mode));
}

// Open the leaderboard from the home page (view only — does not submit a score).
export function viewLeaderboard() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.score = 0;
    state.correct = 0;
    state.round = [];
    state.viewOnly = true;
    state.daily = false; // this is the mode leaderboard, not the daily board
    state.lbViewMode = state.mode; // open the board on the current mode; switchable in place
    endGame();
}

// Show today's daily board without replaying (used when the player already played today).
export function viewDailyResults() {
    state.score = 0;
    state.correct = 0;
    state.round = [];
    state.viewOnly = true;
    state.daily = true;
    endGame();
}

// Populate and show the About dialog (version + total question count).
export async function openAbout() {
    const panel = $('#about-panel');
    $('#about-count').textContent = '…';
    openDialog(panel, $('#about-close'));
    try {
        const all = await window.gameAPI.getQuestions('all');
        $('#about-count').textContent = String(all.length);
    } catch {
        $('#about-count').textContent = '—';
    }
    // This dialog is about the project and who made it, so the mark is the
    // author's photo — not whoever happens to be signed in. Falls back to the
    // app icon if the file is missing.
    const logo = $('#about-logo');
    if (logo) {
        logo.onerror = () => {
            logo.onerror = null;
            logo.src = 'favicon.svg';
            logo.classList.add('is-app-mark');
        };
        logo.classList.remove('is-app-mark');
        logo.src = 'author.jpg';
    }
    try {
        const v = await window.appWindow ?.getVersion ?.();
        if (v) $('#about-version').textContent = 'v' + v;
    } catch {
        /* ignore */ }
}

// Open an external URL the right way for the current platform: through the
// Discord SDK inside an Activity (plain window.open is sandboxed there), a new
// browser tab on the web, or the OS browser via Electron's shell.
export function openExternalUrl(url) {
    if (!url || typeof url !== 'string') return;
    const da = window.DISCORD_ACTIVITY;
    // Discord Activity: external links must go through the SDK (window.open is
    // sandboxed inside the iframe).
    if (da?.active && typeof da.openExternal === 'function') {
        try {
            const r = da.openExternal(url);
            if (r && typeof r.then === 'function') r.catch((e) => console.warn('openExternalLink:', e));
        } catch (e) {
            console.warn('openExternalLink:', e);
        }
        return;
    }
    // Electron desktop: hand off to the OS browser.
    const isWeb = document.documentElement.classList.contains('platform-web');
    if (!isWeb && window.appWindow && typeof window.appWindow.openExternal === 'function') {
        window.appWindow.openExternal(url);
        return;
    }
    // Web: a synthetic <a target="_blank"> click opens a real tab — unlike
    // window.open(...) with a features string, it isn't treated as a popup and
    // so isn't blocked.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Select a mode in place: highlight it, load its bank, enable Start. Stays home.
export async function selectMode(mode) {
    state.mode = MODES[mode] ? mode : 'languages';
    localStorage.setItem('gtl_mode', state.mode);
    // Switching away from the challenged mode means the player opted out — drop the
    // pending challenge so the banner and end-of-round verdict don't linger.
    if (state.challenge && state.mode !== state.challenge.mode) hideChallengeBanner();
    renderHome();

    const startBtn = $('#btn-start');
    startBtn.removeAttribute('data-i18n');
    startBtn.disabled = true;
    startBtn.textContent = t('loading');
    try {
        state.allQuestions = await window.gameAPI.getQuestions(state.mode);
    } catch (err) {
        console.error('Failed to load questions:', err);
        state.allQuestions = [];
    }
    if (state.allQuestions.length) {
        updateStartButtonState();
    } else {
        startBtn.removeAttribute('data-i18n');
        startBtn.disabled = true;
        startBtn.textContent = t('loadFail');
    }
}
