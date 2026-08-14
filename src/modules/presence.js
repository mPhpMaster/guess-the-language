import { sbFetch, supabaseConfigured } from './api.js';
import { screens } from './dom.js';
import { t } from './i18n.js';
import { getDiscordProfile, getSettings, isDiscordActivity } from './identity.js';
import { modeLabel } from './mp-ui.js';
import { getPlayerName } from './settings.js';
import { state } from './state.js';

// ============================================================
//  Discord rich presence + player card
// ============================================================
// Two views onto the same facts — "which round, what score, which mode, and can
// I join?":
//   * Discord's profile card, published with setActivity() (details / state /
//     party size / join secret). This is what a member sees after clicking the
//     player in Discord.
//   * The in-app player card, opened by clicking a row in the lobby / in-game
//     player list.

// The "of N" in Discord's party badge must match the Activity's real capacity:
// Developer Portal -> Activities -> Settings -> "Maximum Participants", set to 12
// to match the 12-slot colour/icon palette the server assigns players from
// (_player_color / _player_icon in schema-multiplayer.sql) — past 12 players start
// sharing an identity, so that is the game's real ceiling. Changing it in the
// portal means changing it here, or overriding in discord-config.js. Note this
// caps the Activity only — a code-joined web room can exceed it, which is why the
// badge grows to fit the actual player count below.
export const MP_PARTY_MAX = Number(window.DISCORD_CONFIG?.maxParticipants) || 12;

// Rich Presence art asset key (Developer Portal -> Rich Presence -> Art Assets).
// Gives the profile card the game's image instead of just the app icon; an
// unknown key simply renders no image, so a stale value is harmless.
export const PRESENCE_IMAGE = window.DISCORD_CONFIG?.presenceImage || '8-modeselect';

// Wall-clock start of the current round, so Discord can show an elapsed timer.
// Must stay stable while the round runs — a moving value would defeat the
// payload de-duplication in discord-activity.js.
export let presenceStartedAt = 0;
// ES module imports are read-only bindings, so other modules (mp-ui) go through
// this setter instead of assigning the export directly.
export function setPresenceStartedAt(value) { presenceStartedAt = value; }

export function canPublishPresence() {
    return Boolean(window.DISCORD_ACTIVITY?.canSetActivity);
}

export function presenceEnabled() {
    return canPublishPresence() && getSettings().discordPresence !== false;
}

// Room-wide question counter. `rooms.question_index` is 0-based and shared by
// everyone in the room, so this is the round every player is on.
export function mpRoundInfo() {
    const room = window.GTL_MULTIPLAYER?.state?.room || null;
    const total = (room?.round_refs || []).length;
    if (!room || !total) return { room, total, current: 0 };
    return { room, total, current: Math.min((room.question_index || 0) + 1, total) };
}

export function presenceScoreLine(score) {
    return `${t('playerCardScore')} ${score}`;
}

// The payload behind the profile card, or null to publish nothing.
export function buildPresenceActivity() {
    if (!presenceEnabled()) return null;

    const onGame = screens.game.classList.contains('active');
    const onResults = screens.results.classList.contains('active');
    const activity = { type: 0, instance: true };
    if (presenceStartedAt) activity.timestamps = { start: Math.floor(presenceStartedAt / 1000) };
    // Hover text on the card image names the mode the player is on.
    const shownMode = modeLabel(
        (state.multiplayer && window.GTL_MULTIPLAYER.state.room?.mode) || state.mode
    );
    if (PRESENCE_IMAGE) {
        activity.assets = { large_image: PRESENCE_IMAGE, large_text: shownMode };
    }

    if (state.multiplayer) {
        const mp = window.GTL_MULTIPLAYER.state;
        const room = mp.room;
        const players = mp.players || [];
        const active = players.filter((p) => !p.spectator).length;
        const { total, current } = mpRoundInfo();

        activity.details = `${shownMode} • ${t('presenceRoom')}`;
        if (room?.status === 'finished' || onResults) {
            activity.state = `${t('presenceResults')} • ${presenceScoreLine(state.score)}`;
        } else if (room?.status === 'playing' && onGame && total) {
            activity.state = state.spectator
                ? `${t('presenceSpectating')} • ${t('playerCardRound')} ${current}/${total}`
                : `${t('playerCardRound')} ${current}/${total} • ${presenceScoreLine(state.score)}`;
        } else {
            activity.state = t('presenceLobby');
        }

        // `party` is what makes Discord render the "(2 of 12)" badge; the id must be
        // identical for everyone in the room so the badge counts the group rather
        // than each player separately. `secrets.join` is what adds "Ask to Join".
        if (room?.id) {
            activity.party = {
                id: `gtl-room-${room.id}`,
                size: [Math.max(active, 1), Math.max(active, MP_PARTY_MAX)]
            };
            if (room.code) activity.secrets = { join: `room:${room.code}` };
        }
        return activity;
    }

    activity.details = `${shownMode} • ${t('presenceSolo')}`;
    if (onResults) {
        activity.state = `${t('presenceResults')} • ${presenceScoreLine(state.score)}`;
    } else if (onGame) {
        const total = state.round.length;
        activity.state = total
            ? `${t('playerCardRound')} ${Math.min(state.index + 1, total)}/${total} • ${presenceScoreLine(state.score)}`
            : presenceScoreLine(state.score);
    } else {
        activity.state = t('presenceMenu');
    }
    // A solo player has no room to hand out, so no join secret — but others in the
    // voice channel can still launch into the Activity, so keep the party badge.
    const instanceId = window.DISCORD_ACTIVITY?.instanceId;
    if (instanceId) activity.party = { id: `gtl-solo-${instanceId}`, size: [1, MP_PARTY_MAX] };
    return activity;
}

// Refresh the profile card. Safe (and cheap) to call on every state change —
// discord-activity.js coalesces these to respect Discord's rate limit.
export function pushPresence() {
    if (!canPublishPresence()) return;
    const activity = buildPresenceActivity();
    if (activity) window.DISCORD_ACTIVITY.setActivity(activity);
    else window.DISCORD_ACTIVITY.clearActivity();
}

export function markPresenceRoundStart() {
    presenceStartedAt = Date.now();
    pushPresence();
}

// ============================================================
//  Live presence heartbeat (feeds the admin "who's playing now" view)
// ============================================================
export function currentPlatform() {
    try {
        if (isDiscordActivity()) return 'discord';
        if (/electron/i.test(navigator.userAgent)) return 'electron';
    } catch (_) {}
    return 'web';
}
export function currentActivity() {
    const s = state.currentScreen;
    if (s === 'game') return 'playing';
    if (s === 'lobby' || (window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state && window.GTL_MULTIPLAYER.state.room)) return 'lobby';
    return 'home';
}
// Best-effort presence ping. Silent on failure — never affects gameplay.
export function sendHeartbeat() {
    try {
        if (!supabaseConfigured()) return;
        const name = getPlayerName();
        if (!name) return;
        if (document.hidden) return;
        const prof = getDiscordProfile();
        sbFetch('rpc/heartbeat', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                p_player: name,
                p_discord_id: (prof && prof.id) || null,
                p_guild_id: (window.DISCORD_ACTIVITY && window.DISCORD_ACTIVITY.guildId) || null,
                p_channel_id: (window.DISCORD_ACTIVITY && window.DISCORD_ACTIVITY.channelId) || null,
                p_mode: state.mode || null,
                p_activity: currentActivity(),
                p_platform: currentPlatform()
            })
        }).catch(() => {});
    } catch (_) {}
}
export let __heartbeatTimer = null;
export function startHeartbeat() {
    if (__heartbeatTimer) return;
    sendHeartbeat();
    __heartbeatTimer = setInterval(sendHeartbeat, 25000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sendHeartbeat(); });
}
