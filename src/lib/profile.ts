import { sbFetch, sbRows, supabaseConfigured } from './supabase';
import { safeDisplayName } from './names';
import { countScoresAbove } from './leaderboard';
import { GAME_MODES } from '../types/models';
import type {
    GameMode,
    ModeRanking,
    PlayerAggregate,
    PlayerStatsRow,
    ScoreRow,
} from '../types/models';

/* ============================================================
   Player profile: aggregate stats, per-mode rankings, follows.
   ============================================================ */

const RANKABLE_MODES: readonly GameMode[] = GAME_MODES;

/**
 * Aggregate stats derived from the player's score rows across all modes — only
 * honest, derivable numbers (win rate and play time come from `player_stats`).
 */
export async function fetchPlayerAggregate(name: string): Promise<PlayerAggregate> {
    const clean = safeDisplayName(name);
    const rows = sbRows(
        await sbFetch<readonly ScoreRow[]>(
            `scores?select=score,multiplayer,mode,created_at&player=eq.${encodeURIComponent(clean)}&limit=1000`,
        ),
    );
    const games = rows.length;
    const best = games > 0 ? Math.max(...rows.map((r) => r.score)) : 0;
    const total = rows.reduce((sum, r) => sum + r.score, 0);
    return {
        games,
        best,
        avg: games > 0 ? Math.round(total / games) : 0,
        total,
        mp: rows.filter((r) => r.multiplayer === true).length,
        modes: new Set(rows.map((r) => r.mode)).size,
        lastPlayed: rows.reduce(
            (latest, r) => (r.created_at && r.created_at > latest ? r.created_at : latest),
            '',
        ),
    };
}

export async function fetchPlayerStats(name: string): Promise<PlayerStatsRow | null> {
    const clean = safeDisplayName(name);
    try {
        const rows = sbRows(
            await sbFetch<readonly PlayerStatsRow[]>(
                'player_stats?select=games,mp_games,wins,seconds,last_seen,xp,level,day_streak,' +
                    `best_day_streak,perfect_games,achievements&player=eq.${encodeURIComponent(clean)}&limit=1`,
            ),
        );
        return rows[0] ?? null;
    } catch {
        return null;
    }
}

/**
 * The player's best score + rank in every mode (approximate rank: the count of
 * score rows above their best, +1 — the same method as the results screen).
 */
export async function fetchPlayerRankings(name: string): Promise<readonly ModeRanking[]> {
    const clean = safeDisplayName(name);
    return Promise.all(
        RANKABLE_MODES.map(async (mode): Promise<ModeRanking> => {
            try {
                const rows = sbRows(
                    await sbFetch<readonly ScoreRow[]>(
                        `scores?select=score&mode=eq.${encodeURIComponent(mode)}` +
                            `&player=eq.${encodeURIComponent(clean)}&order=score.desc&limit=1`,
                    ),
                );
                const best = rows[0]?.score ?? null;
                const rank = best === null ? null : await countScoresAbove(mode, best);
                return { mode, best, rank };
            } catch {
                return { mode, best: null, rank: null };
            }
        }),
    );
}

/** "Online" proxy: active within the last 3 minutes (no true presence tracking). */
export function isRecentlyActive(iso: string | null): boolean {
    if (!iso) return false;
    const then = new Date(iso).getTime();
    return Number.isFinite(then) && Date.now() - then < 3 * 60 * 1000;
}

/* ---------------- Follows (names are self-asserted, like scores) ---------------- */

interface FollowRow {
    readonly followee: string;
}

let followsCache: Set<string> | null = null;

export async function loadFollows(me: string, force = false): Promise<ReadonlySet<string>> {
    if (!supabaseConfigured() || !me) return new Set<string>();
    if (followsCache && !force) return followsCache;
    try {
        const rows = sbRows(
            await sbFetch<readonly FollowRow[]>(
                `follows?select=followee&follower=eq.${encodeURIComponent(safeDisplayName(me))}`,
            ),
        );
        followsCache = new Set(rows.map((row) => safeDisplayName(row.followee)));
    } catch {
        followsCache = new Set<string>();
    }
    return followsCache;
}

export function isFollowing(name: string): boolean {
    return followsCache?.has(safeDisplayName(name)) === true;
}

export async function followPlayer(me: string, name: string): Promise<void> {
    const follower = safeDisplayName(me);
    const followee = safeDisplayName(name);
    if (!follower || !followee || follower === followee) return;
    followsCache ??= new Set<string>();
    followsCache.add(followee);
    try {
        await sbFetch<null>('follows', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify([{ follower, followee }]),
        });
    } catch (err) {
        console.warn('follow failed:', err);
    }
}

export async function unfollowPlayer(me: string, name: string): Promise<void> {
    const follower = safeDisplayName(me);
    const followee = safeDisplayName(name);
    if (!follower || !followee) return;
    followsCache?.delete(followee);
    try {
        await sbFetch<null>(
            `follows?follower=eq.${encodeURIComponent(follower)}&followee=eq.${encodeURIComponent(followee)}`,
            { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        );
    } catch (err) {
        console.warn('unfollow failed:', err);
    }
}

export interface FollowedPlayer {
    readonly name: string;
    readonly score: number;
    readonly avatar: string | null;
}

export async function fetchFollowedPlayers(me: string): Promise<readonly FollowedPlayer[]> {
    const names = [...(await loadFollows(me, true))];
    const rows = await Promise.all(
        names.slice(0, 20).map(async (name): Promise<FollowedPlayer> => {
            try {
                const scores = sbRows(
                    await sbFetch<readonly ScoreRow[]>(
                        `scores?select=score,avatar&player=eq.${encodeURIComponent(name)}&order=score.desc&limit=1`,
                    ),
                );
                const top = scores[0];
                return { name, score: top?.score ?? 0, avatar: top?.avatar ?? null };
            } catch {
                return { name, score: 0, avatar: null };
            }
        }),
    );
    return rows.slice().sort((a, b) => b.score - a.score);
}
