import { safeDisplayName } from '$lib/game/names';
import type { ModeId } from '$lib/game/types';
import { dailyDateKey } from '$lib/game/round';
import { sbFetch, supabaseConfig, supabaseConfigured } from './supabase';

export type Scope = 'all' | 'week';

export interface ScoreRow {
  id: number;
  player: string;
  score: number;
  multiplayer?: boolean;
  avatar?: string | null;
}

export interface DailyRow {
  player: string;
  score: number;
  avatar?: string | null;
}

/** ISO timestamp for 00:00 UTC on the current week's Monday. */
export function weekStartIso(now: Date = new Date()): string {
  const backToMon = (now.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - backToMon)
  ).toISOString();
}

function scopeFilter(scope: Scope): string {
  return scope === 'week' ? `&created_at=gte.${encodeURIComponent(weekStartIso())}` : '';
}

export interface SubmitScoreInput {
  player: string;
  score: number;
  mode: ModeId;
  multiplayer?: boolean;
  avatar?: string | null;
  hiddenLabel: string;
}

export function submitScore(input: SubmitScoreInput): Promise<ScoreRow | null> {
  return sbFetch<ScoreRow[]>('scores', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        player: safeDisplayName(input.player, input.hiddenLabel),
        score: input.score,
        mode: input.mode,
        multiplayer: !!input.multiplayer,
        avatar: input.avatar ?? null
      }
    ])
  }).then((rows) => (Array.isArray(rows) ? (rows[0] ?? null) : null));
}

/**
 * Top scores for a mode.
 *
 * Pulls a wide score-desc window and keeps only each player's single best row,
 * so one person can't occupy several slots. Deduped case-insensitively.
 */
export async function fetchTopScores(
  mode: ModeId,
  scope: Scope,
  limit = 10,
  hiddenLabel = ''
): Promise<ScoreRow[]> {
  const query =
    `scores?select=id,player,score,multiplayer,avatar` +
    `&mode=eq.${encodeURIComponent(mode)}${scopeFilter(scope)}` +
    `&order=score.desc&limit=200`;
  const rows = (await sbFetch<ScoreRow[]>(query)) ?? [];

  const best = new Map<string, ScoreRow>();
  for (const r of rows) {
    const key = safeDisplayName(r.player, hiddenLabel).trim().toLowerCase();
    if (!best.has(key)) best.set(key, r); // score-desc → first seen is the best
  }
  return Array.from(best.values()).slice(0, limit);
}

/**
 * The player's 1-based global rank for a score, via an exact count of better
 * rows. Uses HEAD + `Prefer: count=exact` so no rows travel over the wire.
 */
export async function fetchPersonalRank(mode: ModeId, scope: Scope, score: number): Promise<number | null> {
  const cfg = supabaseConfig();
  if (!cfg || score <= 0) return null;

  const url =
    `${cfg.url}/rest/v1/scores?select=id` +
    `&mode=eq.${encodeURIComponent(mode)}${scopeFilter(scope)}&score=gt.${score}`;

  const res = await fetch(url, {
    method: 'HEAD',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, Prefer: 'count=exact' }
  });
  if (!res.ok) return null;

  const count = Number((res.headers.get('content-range') ?? '').split('/')[1]);
  return Number.isFinite(count) ? count + 1 : null;
}

/**
 * Daily Challenge submission. The table's unique (day, player) plus
 * `resolution=ignore-duplicates` means the first score of the day stands and
 * replays are silently ignored — no retrying for a better result.
 */
export function submitDailyScore(player: string, score: number, hiddenLabel: string): Promise<unknown> {
  return sbFetch('daily_scores', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify([{ day: dailyDateKey(), player: safeDisplayName(player, hiddenLabel), score }])
  });
}

export async function fetchDailyTop(limit = 20): Promise<DailyRow[]> {
  if (!supabaseConfigured()) return [];
  const query =
    `daily_scores?select=player,score,avatar&day=eq.${dailyDateKey()}` +
    `&order=score.desc&limit=${limit}`;
  return (await sbFetch<DailyRow[]>(query)) ?? [];
}
