import { updateAdminButton } from './admin.js';
import { setupErrorLogging } from './api.js';
import { $, showScreen } from './dom.js';
import { bindEvents, selectMode } from './events.js';
import { maybeShowOnboarding } from './home.js';
import { MODES, applyLanguage } from './i18n.js';
import { handleDiscordOAuthReturn, isDiscordActivity, isDiscordEmbedded } from './identity.js';
import { applyChallengeSettings, getChallengeFromUrl, parseChallengePayload, showChallengeBanner } from './leaderboard.js';
import { autoJoinDiscordVoiceRoom, handleMultiplayerUpdate, onDiscordSessionReady, onMpKicked, refreshMultiplayerButtons } from './mp-ui.js';
import { startHeartbeat } from './presence.js';
import { applySettingsToUI } from './settings.js';
import { state } from './state.js';
import { applyUiScale, effectiveScale, hasManualScale } from './ui-scale.js';

// ============================================================
//  Boot
// ============================================================
export async function boot() {
    // Capture errors to the database from the very first line, before any UI wiring.
    setupErrorLogging();
    // Wire up the UI FIRST so the app is always interactive. The Discord Activity
    // handshake (SDK ready / OAuth / token fetch) has no internal timeout, so if
    // it stalls we must NOT let it block bindEvents — otherwise the page renders
    // but every control is dead ("it does nothing").
    bindEvents();
    applyUiScale(effectiveScale(), hasManualScale()); // manual zoom, else auto-fit the width
    if (window.GTL_MULTIPLAYER) {
        window.GTL_MULTIPLAYER.onUpdate = handleMultiplayerUpdate;
        window.GTL_MULTIPLAYER.onKicked = onMpKicked;
    }
    const savedMode = localStorage.getItem('gtl_mode');
    if (savedMode && MODES[savedMode]) state.mode = savedMode;
    applyLanguage();

    // Inside Discord, show a loading veil while the handshake + auto-join run, so
    // the player sees a spinner rather than a flash of Home before the lobby.
    const bootInDiscord = isDiscordEmbedded();
    if (bootInDiscord) {
        showBootLoading();
        setTimeout(hideBootLoading, 12000); // never let it stick if init never resolves
    }

    // Give the Discord Activity a bounded window to finish initialising; fall
    // through to the normal app if it stalls so the UI is never frozen.
    let discordReadyInTime = false;
    if (window.DISCORD_ACTIVITY?.ready) {
        try {
            await Promise.race([
                Promise.resolve(window.DISCORD_ACTIVITY.ready).then(() => { discordReadyInTime = true; }),
                new Promise((resolve) => setTimeout(resolve, 8000))
            ]);
        } catch (err) {
            console.warn('Discord Activity init:', err);
        }
    }

    // Cold first launches (cold /api/token + OAuth) sometimes finish the handshake
    // AFTER the bounded wait above — the identity would then be missing and the
    // player would have to close & relaunch just to get their name read. If the
    // handshake didn't land in time, re-apply the Discord-dependent UI (name,
    // multiplayer buttons, room join) the moment it does. Self-heals without a
    // relaunch.
    if (!discordReadyInTime && window.DISCORD_ACTIVITY?.ready?.then) {
        window.DISCORD_ACTIVITY.ready.then((session) => {
            if (session) onDiscordSessionReady();
        }).catch(() => {});
    }

    // Complete a "Login with Discord" if we were just redirected back with a code
    // (sets the leaderboard name before the settings UI is populated).
    await handleDiscordOAuthReturn();

    // A friend who launched from a "Challenge a friend" DM/link arrives with the
    // challenger's mode + settings + score — in Discord via the Activity
    // custom_id, on the web via a ?challenge= URL param. Preload those and land on
    // the home screen (with a "beat my score" banner) instead of auto-joining.
    const challengeInfo =
        (isDiscordActivity() ? parseChallengePayload(window.DISCORD_ACTIVITY.customId) : null)
        || getChallengeFromUrl();
    if (challengeInfo) applyChallengeSettings(challengeInfo);

    applySettingsToUI();
    refreshMultiplayerButtons();

    if (isDiscordActivity() && !challengeInfo) {
        const joined = await autoJoinDiscordVoiceRoom();
        if (joined) { hideBootLoading(); return; }
    }

    // Reveal Home. Keep the veil up only when we're still inside Discord waiting
    // on a late handshake that will auto-join us — onDiscordSessionReady lifts it
    // then (or the 12s safety timeout does).
    const awaitingLateJoin = bootInDiscord && !challengeInfo && !isDiscordActivity();
    if (!awaitingLateJoin) hideBootLoading();
    showScreen('home');
    selectMode(state.mode);
    updateAdminButton();
    startHeartbeat();
    if (challengeInfo) showChallengeBanner(challengeInfo);
    else setTimeout(maybeShowOnboarding, 500); // first-run welcome (once)
}

export function showBootLoading() { $('#boot-loading')?.classList.remove('hidden'); }
export function hideBootLoading() { $('#boot-loading')?.classList.add('hidden'); }
