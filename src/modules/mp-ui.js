import { adminApi, isAdmin, updateAdminButton } from './admin.js';
import { amIWinner, isPerfectRound, recordPlay, submitMpScores, supabaseConfigured } from './api.js';
import { hideBootLoading } from './boot.js';
import { $, announce, closeDialog, openDialog, screens, setTitlebar, showScreen } from './dom.js';
import { selectMode } from './events.js';
import { clearTimer, hideMpStatus, hideToast, isFillCorrect, normFill, normalizeQuestion, padIndex, recordRoundAnswer, renderCodeChrome, renderQuestionUI, showFeedback, startTimerFromServer, updateCorrect, updateScore, updateStreakPill } from './game.js';
import { formatScore } from './format.js';
import { highlight } from './highlight.js';
import { MODES, diffLabel, t } from './i18n.js';
import { canPlay, getSettings, isDiscordActivity, isDiscordLinked, requiresDiscordLogin, safeDisplayName, showAuthError, syncDiscordNameField, updateInGameProfile } from './identity.js';
import { flashButton, mpDiscordAvatarUrl, mpRoomAvatarOf, mpVisualOf, parseChallengePayload, renderLeaderboard, setBoardHeading } from './leaderboard.js';
import { presenceStartedAt, pushPresence, sendHeartbeat, setPresenceStartedAt } from './presence.js';
import { closePlayerCard, currentPlayerRow, openPlayerCard, refreshPlayerCard } from './profile.js';
import { countUp, renderRoundSummary } from './results.js';
import { timeForDifficulty } from './round.js';
import { getPlayerName, requireNameToInteract, saveSettingsFromUI } from './settings.js';
import { note, sfx } from './sound.js';
import { defaultSettings, state } from './state.js';

// Invite others into the room this card belongs to.
export async function invitePlayersToRoom() {
    const room = window.GTL_MULTIPLAYER.state.room;
    if (isDiscordActivity()) {
        try {
            await window.DISCORD_ACTIVITY.openInviteDialog();
            return;
        } catch (err) {
            console.error('openInviteDialog failed:', err);
            const box = $('#player-card-error');
            if (box) {
                box.textContent = t('inviteFailed');
                box.classList.remove('hidden');
            }
            return;
        }
    }
    if (room?.code) {
        navigator.clipboard?.writeText(room.code).then(
            () => flashButton('#btn-player-card-invite', t('codeCopied')),
            () => {}
        );
    }
}

// Lobby "Invite to this room" button — available to every player, not just the
// host. Inside Discord it opens the native Activity invite sheet (pulls people
// into this voice channel's room); a server's AutoMod can't block it because it
// isn't a text message or a discord.gg link. On the web it copies the room code.
export async function inviteFromLobby() {
    const room = window.GTL_MULTIPLAYER.state.room;
    const note = $('#lobby-invite-note');
    const showNote = (msg) => {
        if (!note) return;
        note.textContent = msg;
        note.classList.remove('hidden');
    };
    if (isDiscordActivity()) {
        try {
            await window.DISCORD_ACTIVITY.openInviteDialog();
        } catch (err) {
            console.error('openInviteDialog failed:', err);
            showNote(t('inviteFailed'));
        }
        return;
    }
    if (room?.code) {
        navigator.clipboard?.writeText(room.code).then(
            () => { flashButton('#btn-lobby-invite', t('codeCopied')); showNote(t('inviteShareCode')); },
            () => showNote(room.code)
        );
    }
}

// ============================================================
//  Multiplayer UI
// ============================================================
export function mpOnline() {
    return window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.configured();
}

// True when the local player joined a room mid-game (server-flagged spectator):
// they watch the round but can't answer, and their score doesn't count.
export function amSpectator() {
    const mp = window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state;
    if (!mp) return false;
    const me = mp.players.find((p) => p.id === mp.playerId);
    return !!(me && me.spectator);
}

export function refreshMultiplayerButtons() {
    const on = mpOnline();
    const discord = isDiscordActivity();
    const mpRow = document.querySelector('.home-mp-actions');
    if (mpRow) mpRow.classList.toggle('hidden', discord);

    // In a Discord Activity the Host/Join row is hidden; instead offer a single
    // "Create Room" button (with a matching hint) as a fallback for when a room
    // wasn't created automatically. We only render the home screen in Discord
    // when auto-join didn't already drop us into a shared room, so surfacing the
    // button here is exactly the "not auto-created" case.
    const discordNote = $('#discord-mp-note');
    const discordHost = $('#btn-discord-host');
    if (discord) {
        if (discordNote) {
            discordNote.textContent = on ? t('discordCreateHint') : t('discordMpUnavailable');
            discordNote.classList.remove('hidden');
        }
        if (discordHost) {
            discordHost.classList.toggle('hidden', !on);
            discordHost.disabled = !(on && canPlay());
        }
    } else {
        if (discordNote) discordNote.classList.add('hidden');
        if (discordHost) discordHost.classList.add('hidden');
    }
    // Hosting or joining needs an online connection plus a playable identity
    // (a name, or a Discord sign-in where that's required).
    const ready = canPlay();
    const authLocked = requiresDiscordLogin() && !isDiscordLinked();
    const enable = on && (ready || authLocked);
    $('#btn-host').disabled = !enable;
    $('#btn-join').disabled = !enable;
    $('#btn-host').classList.toggle('auth-locked', authLocked);
    $('#btn-join').classList.toggle('auth-locked', authLocked);
    $('#btn-host').textContent = authLocked ? `🔒 ${t('hostRoom').replace(/^\S+\s*/, '')}` : t('hostRoom');
    $('#btn-join').textContent = authLocked ? `🔒 ${t('joinRoom').replace(/^\S+\s*/, '')}` : t('joinRoom');
    if (!enable || authLocked) {
        const msg = !ready
            ? (requiresDiscordLogin() ? t('loginDiscordToPlay') : t('nameRequired'))
            : t('mpNeedOnline');
        $('#btn-host').title = msg;
        $('#btn-join').title = msg;
    } else {
        $('#btn-host').removeAttribute('title');
        $('#btn-join').removeAttribute('title');
    }
}

export function modeLabel(mode) {
    const map = {
        languages: 'modeLanguages',
        cybersecurity: 'modeCyber',
        devops: 'modeDevops',
        network: 'modeNetwork',
        gamedev: 'modeGamedev',
        algorithms: 'modeAlgo',
        all: 'modeAll'
    };
    return t(map[mode] || 'modeLanguages');
}

export function renderMpPlayerList(containerSel, players, {
    compact,
    showKick,
    lobby
}) {
    const el = $(containerSel);
    el.innerHTML = '';
    const mp = window.GTL_MULTIPLAYER.state;
    players.forEach((p) => {
        const vis = mpVisualOf(p);
        const row = document.createElement('div');
        row.className = `mp-player-row${p.id === mp.playerId ? ' is-you' : ''}`;
        const av = document.createElement('div');
        av.className = 'mp-player-avatar';
        av.style.boxShadow = 'inset 0 0 0 2px ' + vis.color;
        const avatarUrl = mpDiscordAvatarUrl(p);
        if (avatarUrl) {
            const img = document.createElement('img');
            img.className = 'mp-player-avatar-img';
            img.alt = '';
            img.src = avatarUrl;
            // If the real avatar 404s, degrade to the coloured emoji badge.
            img.addEventListener('error', () => {
                img.remove();
                av.textContent = vis.icon;
                av.style.background = vis.color + '22';
            });
            av.appendChild(img);
        } else {
            av.textContent = vis.icon;
            av.style.background = vis.color + '22';
        }
        const name = document.createElement('div');
        name.className = 'mp-player-name';
        name.textContent = safeDisplayName(p.name) + (p.id === mp.playerId ? ` ${t('you')}` : '');
        row.appendChild(av);
        row.appendChild(name);
        if (p.is_host) {
            const badge = document.createElement('span');
            badge.className = 'mp-host-badge';
            badge.textContent = t('adminBadge');
            row.appendChild(badge);
        }
        // In the lobby nobody has a score yet, so the design shows readiness
        // there and keeps the score column for the in-round strip.
        const sc = document.createElement('div');
        if (lobby) {
            sc.className = 'mp-player-ready';
            sc.textContent = t('badgeReady');
        } else {
            sc.className = 'mp-player-score';
            sc.textContent = formatScore(p.score);
        }
        row.appendChild(sc);
        /* Two different powers that used to look identical.

           `mp.isAdmin` means "I am THIS room's host" — a lobby-only control that
           never targets the host. `isAdmin()` means "I am a site admin", which is
           moderation: it routes through /api/admin, where the signed `adm` claim is
           actually verified, and works mid-round.

           They were indistinguishable, so handing the host role to someone else
           looked like a bug: the host × switched off and the admin × switched on in
           the same place, and it read as "I am somehow still host". The admin
           control now carries a shield and its own label, and it excludes the room
           host the same way the host control does. */
        const room = mp.room;
        const kickAsHost = showKick && mp.isAdmin && !p.is_host;
        const kickAsAdmin = !mp.isAdmin && isAdmin() && p.id !== mp.playerId && !p.is_host && !!room;
        if (kickAsHost || kickAsAdmin) {
            const kick = document.createElement('button');
            kick.className = 'mp-kick-btn' + (kickAsAdmin ? ' is-admin-kick' : '');
            kick.title = kickAsAdmin ? t('kickPlayerAdmin') : t('kickPlayer');
            kick.textContent = kickAsAdmin ? '⛨' : '×';
            kick.addEventListener('click', (ev) => {
                // The row itself opens the player card — don't do both.
                ev.stopPropagation();
                const done = kickAsAdmin
                    ? adminApi('kick', { roomId: room.id, targetPlayerId: p.id })
                    : window.GTL_MULTIPLAYER.kickPlayer(p.id);
                done.catch((e) => console.error(e));
            });
            row.appendChild(kick);
        }
        if (compact) {
            name.textContent = safeDisplayName(p.name);
        }

        // Clicking a player opens their card: round, score, mode and how to invite.
        row.classList.add('is-clickable');
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.title = `${safeDisplayName(p.name)} — ${t('openPlayerCard')}`;
        row.addEventListener('click', () => openPlayerCard(currentPlayerRow(p.id) || p));
        row.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            openPlayerCard(currentPlayerRow(p.id) || p);
        });
        el.appendChild(row);
    });
}

export function syncMpHudFromPlayers() {
    const me = window.GTL_MULTIPLAYER.state.players.find((p) => p.id === window.GTL_MULTIPLAYER.state.playerId);
    if (!me) return;
    state.score = me.score;
    state.correct = me.correct;
    state.streak = me.streak;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak || 0);
    updateScore();
    updateCorrect();
    updateStreakPill();
    renderMpPlayerList('#mp-game-players', window.GTL_MULTIPLAYER.state.players, {
        compact: true,
        showKick: false
    });
}

export function renderLobby(room, players) {
    const discord = isDiscordActivity();
    setTitlebar(room?.code ? `${t('tbLobby')} ${room.code}` : t('lobbyTitle').toLowerCase());
    const label = $('#lobby-label');
    if (label) label.textContent = discord ? t('discordVoiceRoom') : t('roomCode');
    $('#lobby-code').textContent = discord ? t('discordVoiceRoomHint') : (room?.code || '----');
    renderLobbySettings(room);
    renderMpPlayerList('#lobby-players', players, {
        compact: false,
        showKick: room ?.status === 'lobby',
        lobby: room ?.status === 'lobby'
    });
    const playersTitle = $('#lobby-players-title');
    if (playersTitle) playersTitle.textContent = `${t('playersTitle')} (${players.length})`;

    const isAdmin = window.GTL_MULTIPLAYER.state.isAdmin;
    $('#lobby-wait').classList.toggle('hidden', isAdmin);
    $('#btn-lobby-start').classList.toggle('hidden', !isAdmin);
    $('#btn-lobby-end').classList.toggle('hidden', !isAdmin);
    $('#btn-copy-code').classList.toggle('hidden', !isAdmin || discord);

    // "Invite to this room" — shown to everyone when there's something to invite
    // with: the native Activity dialog in Discord, or a shareable code on the web.
    const invite = $('#btn-lobby-invite');
    if (invite) {
        const canInvite = discord || !!room?.code;
        invite.classList.toggle('hidden', !canInvite);
        invite.textContent = t('inviteToRoom');
    }
    $('#lobby-invite-note')?.classList.add('hidden');

    // Inside Discord a lone player may start a solo round; code rooms still want
    // at least two players before the host can start.
    const activeCount = players.filter((p) => !p.spectator).length;
    const minPlayers = isDiscordActivity() ? 1 : 2;
    const canStart = isAdmin && activeCount >= minPlayers && room ?.status === 'lobby';
    $('#btn-lobby-start').disabled = !canStart;
}

// Host-editable game settings in the lobby (feature: "the owner can change the
// settings"). Non-hosts see a read-only summary line.
export function renderLobbySettings(room) {
    const isAdmin = window.GTL_MULTIPLAYER.state.isAdmin;
    const inLobby = !room || room.status === 'lobby';
    const box = $('#lobby-settings');
    if (box) box.classList.toggle('hidden', !(isAdmin && inLobby));

    const s = Object.assign({}, defaultSettings, (room && room.settings) || {});
    const mode = room && MODES[room.mode] ? room.mode : 'languages';

    const timer = s.timer || 'auto';
    if (isAdmin && inLobby && box) {
        $('#lobby-mode-select').value = mode;
        $('#lobby-questions').value = String(s.questions);
        $('#lobby-difficulty').value = s.difficulty;
        $('#lobby-timer').value = String(timer);
        $('#lobby-sound').checked = !!getSettings().sound;
    }

    const diff = s.difficulty === 'all' ? t('diffAll') : diffLabel(s.difficulty);
    const timerLabel = timer === 'auto' ? t('timerAuto') : `${timer}s`;
    $('#lobby-mode').textContent = `${modeLabel(mode)} · ${s.questions} ${t('questionsWord')} · ${diff}`;

    const summary = $('#lobby-summary');
    if (summary) {
        // The host edits through the controls below; everyone else reads this.
        summary.classList.toggle('hidden', !!(isAdmin && inLobby));
        summary.innerHTML = '';
        [
            [t('changeMode'), modeLabel(mode)],
            [t('settingQuestions'), String(s.questions)],
            [t('settingDifficulty'), diff],
            [t('settingTimer'), timerLabel],
            [t('settingSound'), getSettings().sound ? t('soundOn') : t('soundOff')]
        ].forEach(([label, value], i, all) => {
            const row = document.createElement('div');
            row.className = 'lobby-summary-row';
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            if (i === all.length - 1) dd.classList.add('is-on');
            row.append(dt, dd);
            summary.appendChild(row);
        });
    }
}

// Host changed mode / questions / difficulty / timer — push to the room.
export function pushLobbySettings() {
    const mode = $('#lobby-mode-select').value;
    const timerVal = $('#lobby-timer').value;
    const settings = {
        questions: Number($('#lobby-questions').value),
        difficulty: $('#lobby-difficulty').value,
        timer: timerVal === 'auto' ? 'auto' : Number(timerVal),
        feedbackDelay: getSettings().feedbackDelay
    };
    window.GTL_MULTIPLAYER.updateRoomSettings(mode, settings)
        .catch((e) => {
            console.error(e);
            announce(e.message);
        });
}

export function showMpGameChrome(room) {
    $('#mp-game-strip').classList.remove('hidden');
    $('#mp-room-code').textContent = room.code;
    $('#btn-end').classList.toggle('hidden', !window.GTL_MULTIPLAYER.state.isAdmin);
    // A spectator (joined mid-game) can't end the round, but must be able to leave
    // whenever they want — give them their own Leave button in the game chrome.
    $('#btn-mp-leave')?.classList.toggle('hidden', !amSpectator());
    updateInGameProfile();
    renderMpPlayerList('#mp-game-players', window.GTL_MULTIPLAYER.state.players, {
        compact: true,
        showKick: false
    });
}

export function hideMpGameChrome() {
    $('#mp-game-strip').classList.add('hidden');
    $('#btn-end').classList.remove('hidden');
    $('#btn-mp-leave')?.classList.add('hidden');
}

export function showMultiplayerQuestion(room) {
    const refs = room.round_refs || [];
    const ref = refs[room.question_index];
    if (!ref) return;

    const raw = window.GTL_MULTIPLAYER.resolveQuestion(ref, state.allQuestions);
    if (!raw) return;

    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.answered = false;
    state.mpChosen = null;
    state.index = room.question_index;
    state.mpRound = refs;
    hideMpStatus();

    const cur = normalizeQuestion(raw, {
        optionSeed: ref.optionSeed
    });
    state.current = cur;
    $('#q-current').textContent = padIndex(state.index + 1);
    $('#q-total').textContent = padIndex(refs.length);
    $('#correct-total').textContent = String(refs.length);

    const dEl = $('#code-difficulty');
    dEl.dataset.diff = cur.difficulty;
    dEl.textContent = diffLabel(cur.difficulty);

    const codeEl = $('#code-snippet');
    const panel = codeEl.parentElement;
    if (cur.panelIsCode) {
        panel.classList.remove('as-text');
        panel.setAttribute('dir', 'ltr');
        codeEl.innerHTML = highlight(cur.panelText);
    } else {
        panel.classList.add('as-text');
        panel.setAttribute('dir', 'auto');
        codeEl.textContent = cur.panelText;
    }
    renderCodeChrome(cur);

    const qt = $('#question-text');
    if (cur.questionText) {
        qt.classList.remove('hidden');
        qt.textContent = cur.questionText;
    } else {
        qt.classList.add('hidden');
        qt.textContent = '';
    }

    hideToast();
    // Spectators (joined mid-game) watch the round with the answer UI locked.
    renderQuestionUI(cur, state.spectator);
    if (state.spectator) {
        document.querySelectorAll('#options-grid button').forEach((b) => { b.disabled = true; });
        showSpectatorBanner();
    }
    state.questionTime = ref.duration || timeForDifficulty(cur.difficulty);
    state.questionStartedAt = Date.now();
    syncMpHudFromPlayers();
    startTimerFromServer();
}

export function showSpectatorBanner() {
    const el = $('#mp-status');
    if (!el) return;
    el.textContent = t('spectating');
    el.classList.remove('hidden');
}

export async function showMultiplayerReveal(room) {
    // If this question's options were never rendered (a dropped/coalesced realtime
    // update), sync the display to the current question first — otherwise the
    // reveal would run against a stale question and stale option buttons.
    if (!state.current || state.index !== room.question_index) {
        showMultiplayerQuestion(room);
    }
    if (!state.current) return;
    hideMpStatus();
    clearTimer();
    const cur = state.current;
    const ans = cur.answer;
    const chosen = state.mpChosen;

    // Fill-in-the-blank reveal: mark the typed input, show the answer. Grading is
    // canonical-only to match the server's scoring.
    if (cur.style === 'fill') {
        const input = $('#fill-input');
        const submit = $('#fill-submit');
        const ok = !state.spectator && isFillCorrect(cur, chosen, true);
        if (input) {
            input.disabled = true;
            input.classList.remove('fill-correct', 'fill-wrong');
            if (!state.spectator) input.classList.add(ok ? 'fill-correct' : 'fill-wrong');
        }
        if (submit) submit.disabled = true;
        if (state.spectator) {
            showFeedback('good', ans, cur.explanation.en);
        } else if (ok) {
            sfx.correct();
            showFeedback('good', t('correct'), cur.explanation.en);
        } else if (normFill(chosen)) {
            sfx.wrong();
            showFeedback('bad', `${t('wrong')} ${ans}.`, cur.explanation.en);
        } else {
            sfx.wrong();
            showFeedback('bad', `${t('timeUp')} ${ans}.`, cur.explanation.en);
        }
        if (!state.spectator && !state.roundHistory.some((item) => item.questionIndex === state.index)) {
            recordRoundAnswer(cur, chosen, ok, 0, !normFill(chosen));
        }
        state.answered = true;
        return;
    }

    const buttons = Array.from(document.querySelectorAll('#options-grid button'));

    // Reset every option to a clean slate so only THIS question's answer (and the
    // player's own pick) get highlighted — never a leftover from a previous turn.
    buttons.forEach((b) => {
        b.disabled = true;
        b.classList.remove('correct', 'wrong', 'shake', 'mp-selected');
    });
    buttons.forEach((b) => {
        if (b.dataset.answer === ans) b.classList.add('correct');
    });
    if (chosen && chosen !== ans) {
        const mine = buttons.find((b) => b.dataset.answer === chosen);
        if (mine) mine.classList.add('wrong', 'shake');
    }

    // Local result feedback (the key-gated caller runs this once per reveal).
    if (state.spectator) {
        // A watcher just sees the correct answer, no pass/fail sound.
        showFeedback('good', ans, cur.explanation.en);
        state.answered = true;
    } else if (chosen && chosen === ans) {
        sfx.correct();
        showFeedback('good', t('correct'), cur.explanation.en);
    } else if (chosen) {
        sfx.wrong();
        showFeedback('bad', `${t('wrong')} ${ans}.`, cur.explanation.en);
    } else {
        sfx.wrong();
        showFeedback('bad', `${t('timeUp')} ${ans}.`, cur.explanation.en);
    }
    if (!state.spectator && !state.roundHistory.some((item) => item.questionIndex === state.index)) {
        recordRoundAnswer(cur, chosen, chosen === ans, 0, !chosen);
    }
    state.answered = true;

    // Show what every player picked, tagged with their colour + icon + name.
    try {
        const answers = await window.GTL_MULTIPLAYER.fetchAnswers(room.question_index);
        renderRevealChips(answers);
    } catch (e) {
        console.error('fetchAnswers:', e);
    }
}

// Decorate each option button with chips for the players who chose it.
export function renderRevealChips(answers) {
    const players = window.GTL_MULTIPLAYER.state.players;
    const byId = {};
    players.forEach((p) => {
        byId[p.id] = p;
    });

    document.querySelectorAll('#options-grid .mp-answer-chips').forEach((el) => el.remove());
    const buttons = Array.from(document.querySelectorAll('#options-grid button'));

    const groups = {};
    answers.forEach((a) => {
        (groups[a.answer] = groups[a.answer] || []).push(a.player_id);
    });

    buttons.forEach((btn) => {
        const ids = groups[btn.dataset.answer] || [];
        if (!ids.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'mp-answer-chips';
        ids.forEach((pid) => {
            const p = byId[pid];
            if (!p) return;
            const vis = mpVisualOf(p);
            const chip = document.createElement('span');
            chip.className = 'mp-answer-chip';
            chip.title = vis.name;
            chip.style.background = vis.color + '22';
            chip.style.boxShadow = 'inset 0 0 0 1px ' + vis.color;
            const ic = document.createElement('span');
            ic.className = 'mp-chip-ic';
            ic.textContent = vis.icon;
            const nm = document.createElement('span');
            nm.className = 'mp-chip-nm';
            nm.textContent = vis.name;
            nm.style.color = vis.color;
            chip.appendChild(ic);
            chip.appendChild(nm);
            wrap.appendChild(chip);
        });
        btn.appendChild(wrap);
    });
}

// Build the multiplayer scoreboard. Keeps the room alive so "Play again" works.
export function renderMpResults() {
    const mpState = window.GTL_MULTIPLAYER.state;
    const players = mpState.players;
    showScreen('results');

    $('#results-head').classList.remove('hidden');
    $('#screen-results').classList.remove('is-leaderboard-view');
    $('#result-stats').classList.remove('hidden');
    $('#answer-review').classList.remove('hidden');
    $('#personal-result').classList.add('hidden');
    $('#btn-challenge').classList.add('hidden');
    $('#btn-replay').classList.remove('hidden');
    $('#btn-replay').textContent = t('backToLobby'); // -> room lobby (stays in room)
    $('#btn-menu').textContent = t('leaveRoom'); // "Leave" -> main menu

    const me = players.find((p) => p.id === mpState.playerId);
    countUp($('#final-score'), me ? me.score : 0, 900);
    $('#results-correct').textContent = String(me ? me.correct : 0);
    $('#results-total').textContent = String(
        (state.mpRound && state.mpRound.length) ||
        (mpState.room && mpState.room.round_refs && mpState.room.round_refs.length) || 0
    );
    state.correct = me ? me.correct : 0;
    state.score = me ? me.score : 0;
    state.round = new Array(Number($('#results-total').textContent) || state.roundHistory.length);
    renderRoundSummary();
    setBoardHeading(t('roomResults'), '');
    renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(mpRoomAvatarOf));
    $('#lb-note').className = 'lb-note';
    $('#lb-note').textContent = '';

    if (!state.mpResultsShown) {
        sfx.finish();
        state.mpResultsShown = true;
        registerMpScores();
        // Log my play-time + a multiplayer win if I finished top of the room, plus XP.
        if (!state.spectator) recordPlay(true, amIWinner(), state.score, isPerfectRound());
    }
}

// Register every player's final score in the global leaderboard, flagged as a
// multiplayer result. The host submits once for the whole room (one row each).
export function registerMpScores() {
    if (!supabaseConfigured()) return;
    const mpState = window.GTL_MULTIPLAYER.state;
    if (!mpState.isAdmin) return;
    const mode = (mpState.room && mpState.room.mode) || state.mode;
    const rows = mpState.players
        // Never post a 0 (or negative) result to the global board — a player who
        // scored nothing shouldn't create a "— 0 pts" leaderboard entry.
        .filter((p) => (p.score || 0) > 0 && !p.spectator)
        .map((p) => ({
            player: p.name,
            score: p.score,
            mode,
            multiplayer: true,
            // Persist each player's real Discord photo so EVERYONE sees it on the
            // board later (not just the local player via the live render override).
            // The host resolves it from the shared Activity participants; null → emoji.
            avatar: mpDiscordAvatarUrl(p) || null
        }));
    if (!rows.length) return;
    submitMpScores(rows).catch((e) => console.error('register mp scores:', e));
}

// "Play again": host resets the room to its lobby; everyone else returns to the
// lobby and waits for the host to start the next round.
export function mpPlayAgain() {
    const mpState = window.GTL_MULTIPLAYER.state;
    state.mpResultsShown = false;
    state.mpSyncKey = '';
    if (mpState.isAdmin) {
        window.GTL_MULTIPLAYER.restartRoom().catch((e) => {
            console.error(e);
            announce(e.message);
        });
    } else {
        renderLobby(mpState.room, mpState.players);
        showScreen('lobby');
    }
}

export function handleMultiplayerUpdate(room, players) {
    if (!room) return;

    if (room.status === 'lobby') {
        // Fresh lobby, or back from a finished game via "Play again". Everyone in
        // the lobby is a full player again (spectator flags were cleared server-side).
        state.multiplayer = true;
        state.mpSyncKey = '';
        state.mpResultsShown = false;
        state.spectator = false;
        state.roundHistory = [];
        state.bestStreak = 0;
        clearTimer();
        hideMpStatus();
        hideMpGameChrome();
        renderLobby(room, players);
        if (!screens.lobby.classList.contains('active')) showScreen('lobby');
        setPresenceStartedAt(0);
        pushPresence();
        refreshPlayerCard();
        return;
    }

    if (room.status === 'closed') {
        // Room was removed before the game started (host left / cleaned up).
        if (!state.multiplayer) return;
        window.GTL_MULTIPLAYER.teardown();
        returnHome();
        return;
    }

    if (room.status === 'finished') {
        if (!state.multiplayer) return;
        clearTimer();
        hideMpStatus();
        hideMpGameChrome();
        if (!screens.results.classList.contains('active')) {
            renderMpResults();
        } else {
            // Already on the scoreboard — just refresh standings without re-animating.
            renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(mpRoomAvatarOf));
        }
        pushPresence();
        refreshPlayerCard();
        return;
    }

    if (room.status === 'playing') {
        state.multiplayer = true;
        state.mpResultsShown = false;
        state.spectator = amSpectator();
        if (!state.gameStartMs) state.gameStartMs = Date.now(); // play-time tracking
        const key = `${room.question_index}|${room.phase}`;
        if (key !== state.mpSyncKey) {
            state.mpSyncKey = key;
            if (!screens.game.classList.contains('active')) showScreen('game');
            showMpGameChrome(room);
            if (room.phase === 'question') {
                showMultiplayerQuestion(room);
            } else if (room.phase === 'reveal') {
                showMultiplayerReveal(room);
            }
            // Stamp the round start once, on the first question of the round, so the
            // Discord card shows a stable elapsed timer.
            if (!presenceStartedAt || room.question_index === 0) setPresenceStartedAt(Date.now());
        }
        syncMpHudFromPlayers();
        pushPresence();
        refreshPlayerCard();
    }
}

// Leave multiplayer and reload the selected single-player bank (multiplayer
// overwrites state.allQuestions with the full 'all' set).
export function returnHome() {
    state.multiplayer = false;
    state.mpResultsShown = false;
    state.mpSyncKey = '';
    clearTimer();
    hideMpStatus();
    hideMpGameChrome();
    closePlayerCard();
    // Drop the round's elapsed timer BEFORE the screen change, so the presence
    // push that showScreen() triggers already describes a player in the menu.
    setPresenceStartedAt(0);
    showScreen('home');
    selectMode(state.mode);
    pushPresence();
}

// Multiplayer rounds can use any bank (the host picks the mode), so always load
// the full set — refs carry their own bank and resolve regardless of mode.
export async function loadAllBanks() {
    try {
        state.allQuestions = await window.gameAPI.getQuestions('all');
    } catch (e) {
        console.error('Failed to load question banks:', e);
    }
}

// Re-apply everything that depends on the Discord identity. Called when the
// Activity handshake finishes AFTER boot's bounded wait elapsed (a cold
// /api/token start on first launch can push it past the timeout). Without this
// the player has to close & relaunch the Activity just to get their name read.
export function onDiscordSessionReady() {
    if (!isDiscordActivity()) return;
    syncDiscordNameField();
    refreshMultiplayerButtons();
    updateAdminButton();
    sendHeartbeat();
    // If we fell through to Home solo because the identity wasn't ready in time,
    // join the voice-channel room now — but never hijack a challenge landing.
    const onHome = $('#screen-home') && $('#screen-home').classList.contains('active');
    const hasChallenge = !!parseChallengePayload(window.DISCORD_ACTIVITY.customId);
    if (onHome && !state.multiplayer && !hasChallenge) {
        autoJoinDiscordVoiceRoom().finally(hideBootLoading);
    } else {
        hideBootLoading();
    }
}

export async function autoJoinDiscordVoiceRoom() {
    if (!isDiscordActivity() || !mpOnline()) return false;
    // Guard against a double join if boot() and the late self-heal both fire.
    if (state.autoJoinInFlight) return false;
    state.autoJoinInFlight = true;
    try {
        return await autoJoinDiscordVoiceRoomInner();
    } finally {
        state.autoJoinInFlight = false;
    }
}

export async function autoJoinDiscordVoiceRoomInner() {
    if (!isDiscordActivity() || !mpOnline()) return false;

    const instanceId = window.DISCORD_ACTIVITY.instanceId;
    const userId = window.DISCORD_ACTIVITY.user?.id;
    if (!instanceId || !userId) return false;

    const note = $('#discord-mp-note');
    if (note) {
        note.textContent = t('discordJoining');
        note.classList.remove('hidden');
    }

    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinDiscordRoom(
            instanceId,
            state.mode,
            getSettings(),
            getPlayerName(),
            userId
        );
        state.multiplayer = true;
        state.viewOnly = false;
        state.mpSyncKey = '';
        const mp = window.GTL_MULTIPLAYER.state;
        state.spectator = amSpectator();
        // Joined a game already in progress → spectate: let the realtime sync
        // render the live question rather than forcing the (wrong) lobby view.
        if (mp.room && mp.room.status === 'playing') {
            handleMultiplayerUpdate(mp.room, mp.players);
        } else {
            renderLobby(mp.room, mp.players);
            showScreen('lobby');
        }
        return true;
    } catch (err) {
        console.error('Discord voice room join failed:', err);
        if (note) note.textContent = t('discordMpUnavailable');
        return false;
    }
}

// Discord "Back to Lobby": (re)join the voice-channel's shared room and land in
// its lobby. Works even after a game ended and the player was sent Home — the
// room is keyed to the voice-channel instance, so it can always be re-entered.
export async function enterDiscordLobby() {
    if (!isDiscordActivity() || !mpOnline()) return;
    const btn = $('#btn-discord-host');
    if (btn) btn.disabled = true;
    try {
        const ok = await autoJoinDiscordVoiceRoom();
        if (!ok) {
            const note = $('#discord-mp-note');
            if (note) {
                note.textContent = t('returnLobbyFailed');
                note.classList.remove('hidden');
            }
            return;
        }
        // Rejoined a finished room as host → reset it to the lobby so a new round
        // can start; guests will follow via the realtime 'lobby' update.
        const mp = window.GTL_MULTIPLAYER;
        if (mp.state.isAdmin && mp.state.room && mp.state.room.status === 'finished') {
            try {
                await mp.restartRoom();
                renderLobby(mp.state.room, mp.state.players);
            } catch (e) {
                console.error('restart on return-to-lobby:', e);
            }
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

export async function hostRoomFlow() {
    if (!mpOnline()) return;
    if (!requireNameToInteract()) return;
    saveSettingsFromUI();
    const name = getPlayerName();
    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.hostRoom(state.mode, getSettings(), name);
        state.multiplayer = true;
        state.viewOnly = false;
        showScreen('lobby');
        renderLobby(window.GTL_MULTIPLAYER.state.room, window.GTL_MULTIPLAYER.state.players);
    } catch (e) {
        console.error(e);
        showAuthError(t('mpHostFail') + ': ' + e.message);
    }
}

export function openJoinModal() {
    if (!mpOnline()) return;
    if (!requireNameToInteract()) return;
    saveSettingsFromUI();
    $('#join-code').value = '';
    $('#join-error').classList.add('hidden');
    openDialog($('#join-modal'), $('#join-code'));
}

export function closeJoinModal() {
    closeDialog($('#join-modal'));
}

export async function confirmJoinRoom() {
    const code = window.GTL_MULTIPLAYER.normalizeCode($('#join-code').value);
    if (code.length !== 4) {
        $('#join-error').textContent = t('roomCode');
        $('#join-error').classList.remove('hidden');
        return;
    }
    const btn = $('#btn-join-confirm');
    const prevLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('joining'); }
    $('#join-error').classList.add('hidden');
    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinRoom(code, getPlayerName());
        closeJoinModal();
        state.multiplayer = true;
        state.viewOnly = false;
        state.spectator = amSpectator();
        const mp = window.GTL_MULTIPLAYER.state;
        if (mp.room && mp.room.status === 'playing') {
            handleMultiplayerUpdate(mp.room, mp.players);
        } else {
            showScreen('lobby');
            renderLobby(mp.room, mp.players);
        }
    } catch (e) {
        $('#join-error').textContent = t('mpJoinFail') + ': ' + e.message;
        $('#join-error').classList.remove('hidden');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = prevLabel || t('joinConfirm'); }
    }
}

// Admin "Join" from the panel's Live tab: drop into the room a live player is in.
// The seat itself is created server-side (`join_room` admin action, gated by the
// unlock token); this only leaves whatever room we were in, adopts the returned
// ids, and lands on the same screens confirmJoinRoom() does. Throws on failure so
// the caller can show a friendly message — a reaped room is a normal outcome.
export async function adminJoinRoomFlow(roomId) {
    if (!roomId) return;
    // Leave first, or our previous room_players row is left orphaned in that room.
    let leftRoom = false;
    if (state.multiplayer) {
        try {
            await window.GTL_MULTIPLAYER.leaveRoom();
        } catch (e) {
            console.warn('admin join: leaving current room failed:', e);
        }
        state.multiplayer = false;
        leftRoom = true;
    }
    try {
        await loadAllBanks();
        const data = await adminApi('join_room', { roomId, name: getPlayerName() });
        const seat = (data && data.room) || null;
        if (!seat || !seat.roomId || !seat.playerId) throw new Error('join_room returned no seat');
        // seat.name may be a SUFFIXED variant of the name we sent (" (2)") when it
        // collided inside that room. We deliberately don't write it back to the
        // local player name: the suffix disambiguates one room, while getPlayerName()
        // is the account identity that progress/follows/leaderboards key off. Every
        // room-local view resolves us by playerId (me(), amSpectator(), the room
        // leaderboard's `you`), so the suffixed name renders from the server row.
        await window.GTL_MULTIPLAYER.adoptSession({
            roomId: seat.roomId,
            playerId: seat.playerId,
            code: seat.code
        });
        // ---- landing tail, same as confirmJoinRoom() ----
        state.multiplayer = true;
        state.viewOnly = false;
        state.spectator = amSpectator();
        const mp = window.GTL_MULTIPLAYER.state;
        if (mp.room && mp.room.status === 'playing') {
            handleMultiplayerUpdate(mp.room, mp.players);
        } else {
            showScreen('lobby');
            renderLobby(mp.room, mp.players);
        }
    } catch (e) {
        // We may already have given up the old seat — don't strand the player on a
        // lobby/game screen for a room they are no longer in.
        if (leftRoom) returnHome();
        throw e;
    }
}

export async function lobbyStartGame() {
    const room = window.GTL_MULTIPLAYER.state.room;
    const settings = Object.assign({}, getSettings(), (room && room.settings) || {}, {
        mode: (room && room.mode) || state.mode
    });
    const built = window.GTL_MULTIPLAYER.buildRoundForRoom(state.allQuestions, settings);
    state.mpRound = built.roundRefs;
    try {
        await window.GTL_MULTIPLAYER.startRoom(built.roundRefs, built.answerKeys);
    } catch (e) {
        console.error(e);
        announce(e.message);
    }
}

export async function leaveMultiplayer() {
    await window.GTL_MULTIPLAYER.leaveRoom();
    returnHome();
}

export function onMpKicked() {
    announce(t('mpKicked'));
    window.GTL_MULTIPLAYER.teardown();
    returnHome();
}
