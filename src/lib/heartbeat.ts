import { sbFetch, supabaseConfigured } from './supabase';
import { currentPlatform } from './platform';
import { discordActivity } from './discord';
import { discordProfile, playerName } from './identity';
import type { GameMode, ScreenName } from '../types/models';

/* ============================================================
   Live presence heartbeat — feeds the admin "who's playing now"
   view. Silent on failure; never affects gameplay.
   ============================================================ */

const INTERVAL_MS = 25_000;

export type ActivityKind = 'home' | 'lobby' | 'playing';

interface HeartbeatContext {
    readonly screen: ScreenName;
    readonly inRoom: boolean;
    readonly mode: GameMode;
}

let readContext: () => HeartbeatContext = () => ({
    screen: 'home',
    inRoom: false,
    mode: 'all',
});

let timer: ReturnType<typeof setInterval> | null = null;

function activityKind(context: HeartbeatContext): ActivityKind {
    if (context.screen === 'game') return 'playing';
    if (context.screen === 'lobby' || context.inRoom) return 'lobby';
    return 'home';
}

export function sendHeartbeat(): void {
    try {
        if (!supabaseConfigured() || document.hidden) return;
        const name = playerName();
        if (!name) return;
        const context = readContext();
        void sbFetch<null>('rpc/heartbeat', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                p_player: name,
                p_discord_id: discordProfile()?.id ?? null,
                p_guild_id: discordActivity.guildId,
                p_channel_id: discordActivity.channelId,
                p_mode: context.mode,
                p_activity: activityKind(context),
                p_platform: currentPlatform(),
            }),
        }).catch(() => undefined);
    } catch {
        /* never break gameplay */
    }
}

export function startHeartbeat(context: () => HeartbeatContext): void {
    readContext = context;
    if (timer) return;
    sendHeartbeat();
    timer = setInterval(sendHeartbeat, INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) sendHeartbeat();
    });
}
