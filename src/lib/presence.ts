import { discordActivity, type PresenceActivity } from './discord';
import { settings } from './settings';
import { modeLabel, t } from '../i18n';
import type { GameMode, Room, RoomPlayer, ScreenName } from '../types/models';

/* ============================================================
   Discord rich presence — the "Playing … / Round 3 of 10 /
   Ask to Join" card on a member's profile.
   ============================================================ */

/**
 * The "of N" in Discord's party badge must match the Activity's real capacity
 * (Developer Portal -> Activities -> Maximum Participants), which is 12 to match
 * the 12-slot colour palette the server assigns players from.
 */
const PARTY_MAX = window.DISCORD_CONFIG?.maxParticipants ?? 12;

/**
 * Rich Presence art asset key (Developer Portal -> Rich Presence -> Art Assets).
 * An unknown key simply renders no image, so a stale value is harmless.
 */
const PRESENCE_IMAGE = window.DISCORD_CONFIG?.presenceImage ?? '8-modeselect';

export interface PresenceContext {
    readonly screen: ScreenName;
    readonly mode: GameMode;
    readonly score: number;
    readonly index: number;
    readonly roundLength: number;
    readonly multiplayer: boolean;
    readonly spectator: boolean;
    readonly room: Room | null;
    readonly players: readonly RoomPlayer[];
}

let readContext: (() => PresenceContext) | null = null;

export function configurePresence(context: () => PresenceContext): void {
    readContext = context;
}

/**
 * Wall-clock start of the current round, so Discord can show an elapsed timer.
 * Must stay stable while the round runs — a moving value would defeat the
 * payload de-duplication in the SDK wrapper.
 */
let startedAt = 0;

export function startPresenceClock(): void {
    startedAt = Date.now();
    pushPresence();
}

export function resetPresenceClock(): void {
    startedAt = 0;
    pushPresence();
}

function presenceEnabled(): boolean {
    return discordActivity.canSetActivity && settings().discordPresence;
}

function scoreLine(score: number): string {
    return `${t('playerCardScore')} ${score}`;
}

function buildActivity(context: PresenceContext): PresenceActivity | null {
    if (!presenceEnabled()) return null;

    const onGame = context.screen === 'game';
    const onResults = context.screen === 'results';
    const activity: PresenceActivity = { type: 0, instance: true };
    if (startedAt) activity.timestamps = { start: Math.floor(startedAt / 1000) };

    const shownMode = modeLabel(
        (context.multiplayer ? context.room?.mode : undefined) ?? context.mode,
    );
    if (PRESENCE_IMAGE) {
        activity.assets = { large_image: PRESENCE_IMAGE, large_text: shownMode };
    }

    if (context.multiplayer) {
        const room = context.room;
        const active = context.players.filter((player) => !player.spectator).length;
        const total = (room?.round_refs ?? []).length;
        const current = total > 0 ? Math.min((room?.question_index ?? 0) + 1, total) : 0;

        activity.details = `${shownMode} • ${t('presenceRoom')}`;
        if (room?.status === 'finished' || onResults) {
            activity.state = `${t('presenceResults')} • ${scoreLine(context.score)}`;
        } else if (room?.status === 'playing' && onGame && total > 0) {
            activity.state = context.spectator
                ? `${t('presenceSpectating')} • ${t('playerCardRound')} ${current}/${total}`
                : `${t('playerCardRound')} ${current}/${total} • ${scoreLine(context.score)}`;
        } else {
            activity.state = t('presenceLobby');
        }

        // `party` is what makes Discord render the "(2 of 12)" badge; the id must be
        // identical for everyone in the room so it counts the group. `secrets.join`
        // is what adds "Ask to Join".
        if (room?.id) {
            activity.party = {
                id: `gtl-room-${room.id}`,
                size: [Math.max(active, 1), Math.max(active, PARTY_MAX)],
            };
            if (room.code) activity.secrets = { join: `room:${room.code}` };
        }
        return activity;
    }

    activity.details = `${shownMode} • ${t('presenceSolo')}`;
    if (onResults) {
        activity.state = `${t('presenceResults')} • ${scoreLine(context.score)}`;
    } else if (onGame && context.roundLength > 0) {
        const current = Math.min(context.index + 1, context.roundLength);
        activity.state = `${t('playerCardRound')} ${current}/${context.roundLength} • ${scoreLine(context.score)}`;
    } else if (onGame) {
        activity.state = scoreLine(context.score);
    } else {
        activity.state = t('presenceMenu');
    }

    // A solo player has no room to hand out, so no join secret — but others in the
    // voice channel can still launch the Activity, so keep the party badge.
    const instanceId = discordActivity.instanceId;
    if (instanceId) {
        activity.party = { id: `gtl-solo-${instanceId}`, size: [1, PARTY_MAX] };
    }
    return activity;
}

/**
 * Refresh the profile card. Safe (and cheap) to call on every state change — the
 * SDK wrapper coalesces pushes to respect Discord's rate limit.
 */
export function pushPresence(): void {
    if (!discordActivity.canSetActivity || !readContext) return;
    const activity = buildActivity(readContext());
    if (activity) discordActivity.setActivity(activity);
    else discordActivity.clearActivity();
}
