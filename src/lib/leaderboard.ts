import { sbCount, sbFetch, sbRows, supabaseConfigured } from './supabase';
import { nameKey, safeDisplayName } from './names';
import { ownAvatarUrl } from './identity';
import { dailyDateKey } from './daily';
import type { GameMode, LeaderboardScope, ScoreRow } from '../types/models';

/* ============================================================
   Global leaderboard + daily board reads and writes.
   ============================================================ */

/** Start of the current week — Monday 00:00 UTC. */
function weekStartIso(): string {
    const now = new Date();
    const backToMonday = (now.getUTCDay() + 6) % 7;
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - backToMonday),
    ).toISOString();
}

function scopeFilter(scope: LeaderboardScope): string {
    return scope === 'week' ? `&created_at=gte.${encodeURIComponent(weekStartIso())}` : '';
}

/**
 * Server-side name screening. The client's own blocklist is only a first pass —
 * this RPC is the authority, so a name it rejects must never reach the board.
 * Returns `true` when the check could not run, so an outage never blocks play.
 */
export async function isNameAllowedByServer(name: string): Promise<boolean> {
    if (!supabaseConfigured()) return true;
    try {
        const allowed = await sbFetch<boolean>('rpc/is_safe_player_name', {
            method: 'POST',
            body: JSON.stringify({ p_name: name }),
        });
        return allowed !== false;
    } catch (err) {
        console.warn('Unable to verify name safety server-side:', err);
        return true;
    }
}

export async function submitScore(
    player: string,
    score: number,
    mode: GameMode,
    multiplayer = false,
): Promise<ScoreRow | null> {
    const rows = await sbFetch<readonly ScoreRow[]>('scores', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([
            {
                player: safeDisplayName(player),
                score,
                mode,
                multiplayer,
                avatar: ownAvatarUrl(),
            },
        ]),
    });
    return rows?.[0] ?? null;
}

export interface MpScoreRow {
    readonly player: string;
    readonly score: number;
    readonly mode: GameMode;
    readonly multiplayer: true;
    readonly avatar: string | null;
}

/** One insert for the whole finished room; `return=minimal` answers 204. */
export async function submitMultiplayerScores(rows: readonly MpScoreRow[]): Promise<void> {
    if (rows.length === 0) return;
    await sbFetch<null>('scores', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(rows.map((row) => ({ ...row, player: safeDisplayName(row.player) }))),
    });
}

/**
 * Pull a wide score-desc window, then keep only each player's single best row so
 * one person can't occupy several slots (deduped by case-insensitive name).
 */
export async function fetchTopScores(
    mode: GameMode,
    scope: LeaderboardScope,
    limit = 10,
): Promise<readonly ScoreRow[]> {
    const rows = sbRows(
        await sbFetch<readonly ScoreRow[]>(
            `scores?select=id,player,score,multiplayer,avatar&mode=eq.${encodeURIComponent(mode)}` +
                `${scopeFilter(scope)}&order=score.desc&limit=200`,
        ),
    );
    const best = new Map<string, ScoreRow>();
    for (const row of rows) {
        const key = nameKey(row.player);
        if (!best.has(key)) best.set(key, row); // score-desc → first seen is the best
    }
    return [...best.values()].slice(0, limit);
}

export async function fetchPersonalRank(
    mode: GameMode,
    scope: LeaderboardScope,
    score: number,
): Promise<number | null> {
    if (!supabaseConfigured() || score <= 0) return null;
    const count = await sbCount(
        `scores?select=id&mode=eq.${encodeURIComponent(mode)}${scopeFilter(scope)}&score=gt.${score}`,
    );
    return count === null ? null : count + 1;
}

export async function countScoresAbove(mode: GameMode, score: number): Promise<number | null> {
    const count = await sbCount(
        `scores?select=id&mode=eq.${encodeURIComponent(mode)}&score=gt.${score}`,
    );
    return count === null ? null : count + 1;
}

/* ---------------- Daily board ---------------- */

/**
 * The unique (day, player) plus `resolution=ignore-duplicates` means the FIRST
 * score of the day stands and replays are silently ignored.
 */
export async function submitDailyScore(player: string, score: number): Promise<void> {
    await sbFetch<null>('daily_scores', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([
            {
                day: dailyDateKey(),
                player: safeDisplayName(player),
                score: Math.max(0, Math.round(score)),
                avatar: ownAvatarUrl(),
            },
        ]),
    });
}

export async function fetchDailyTop(limit = 20): Promise<readonly ScoreRow[]> {
    return sbRows(
        await sbFetch<readonly ScoreRow[]>(
            `daily_scores?select=id,player,score,avatar&day=eq.${dailyDateKey()}` +
                `&order=score.desc&limit=${limit}`,
        ),
    );
}
