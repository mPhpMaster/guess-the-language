import { safeDisplayName } from '$lib/game/names';
import type { ModeId } from '$lib/game/types';
import { sbFetch, supabaseConfig, supabaseConfigured } from './supabase';

/**
 * Player profiles: aggregate stats, progression (XP / level / streak) and the
 * follow graph. The server's `record_progress` RPC is the source of truth for
 * XP, streaks and achievement unlocks — nothing here awards anything.
 */

export interface PlayerActivity {
  games: number;
  mp_games: number;
  wins: number;
  seconds: number;
  last_seen: string | null;
  xp: number;
  level: number;
  day_streak: number;
  best_day_streak: number;
  perfect_games: number;
  achievements: string[] | null;
}

export interface PlayerStats {
  games: number;
  best: number;
  avg: number;
  total: number;
  mp: number;
  modes: number;
  lastPlayed: string;
}

export interface ModeRank {
  mode: ModeId;
  best: number;
  rank: number | null;
}

interface ScoreRow {
  score: number;
  multiplayer: boolean;
  mode: ModeId;
  created_at: string;
}

const ACTIVITY_COLUMNS =
  'games,mp_games,wins,seconds,last_seen,xp,level,day_streak,best_day_streak,perfect_games,achievements';

export async function fetchPlayerActivity(name: string, hiddenLabel = ''): Promise<PlayerActivity | null> {
  const clean = safeDisplayName(name, hiddenLabel);
  try {
    const rows = await sbFetch<PlayerActivity[]>(
      `player_stats?select=${ACTIVITY_COLUMNS}&player=eq.${encodeURIComponent(clean)}&limit=1`
    );
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Aggregate stats derived from the player's own score rows. Win rate and skill
 * rating aren't tracked server-side, so only honest, derivable numbers appear.
 */
export async function fetchPlayerStats(name: string, hiddenLabel = ''): Promise<PlayerStats> {
  const clean = safeDisplayName(name, hiddenLabel);
  const rows =
    (await sbFetch<ScoreRow[]>(
      `scores?select=score,multiplayer,mode,created_at&player=eq.${encodeURIComponent(clean)}&limit=1000`
    )) ?? [];

  const games = rows.length;
  const total = rows.reduce((sum, r) => sum + (r.score || 0), 0);
  return {
    games,
    best: games ? Math.max(...rows.map((r) => r.score)) : 0,
    avg: games ? Math.round(total / games) : 0,
    total,
    mp: rows.filter((r) => r.multiplayer).length,
    modes: new Set(rows.map((r) => r.mode)).size,
    lastPlayed: rows.reduce((max, r) => (r.created_at && r.created_at > max ? r.created_at : max), '')
  };
}

/** "Online" proxy: active within the last 3 minutes (no true presence tracking). */
export function isRecentlyActive(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < 3 * 60 * 1000;
}

// ---------- progression ----------

/** Level curve mirrors the server: level = floor(sqrt(xp/1000)) + 1. */
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 1000)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.pow(Math.max(1, level) - 1, 2) * 1000;
}

/** i18n key for the title shown next to a level. */
export function levelTitleKey(level: number): string {
  if (level >= 11) return 'titleGuru';
  if (level >= 9) return 'titleExpert';
  if (level >= 7) return 'titleHacker';
  if (level >= 5) return 'titleCoder';
  if (level >= 3) return 'titleApprentice';
  return 'titleNovice';
}

/**
 * Every achievement the profile can display. Names come from i18n (`ach_<id>`);
 * the server decides which are unlocked.
 */
export const ACHIEVEMENTS: ReadonlyArray<{ id: string; icon: string }> = [
  { id: 'rookie', icon: '🎮' },
  { id: 'dedicated', icon: '🔁' },
  { id: 'centurion', icon: '💯' },
  { id: 'first_win', icon: '🥇' },
  { id: 'champion', icon: '🏆' },
  { id: 'perfect', icon: '✨' },
  { id: 'flawless', icon: '🌟' },
  { id: 'streak3', icon: '🔥' },
  { id: 'streak7', icon: '⚡' },
  { id: 'marathon', icon: '⏱️' },
  { id: 'level5', icon: '🚀' },
  { id: 'level10', icon: '👑' }
];

// ---------- per-mode rankings ----------

export const RANKABLE_MODES: readonly ModeId[] = [
  'languages', 'cybersecurity', 'devops', 'network', 'gamedev', 'algorithms', 'all'
];

/** Exact count of scores above `score` in a mode, via a HEAD count query. */
async function countScoresAbove(mode: ModeId, score: number): Promise<number | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const res = await fetch(
    `${cfg.url}/rest/v1/scores?select=id&mode=eq.${encodeURIComponent(mode)}&score=gt.${score}`,
    {
      method: 'HEAD',
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, Prefer: 'count=exact' }
    }
  );
  if (!res.ok) return null;
  const count = Number((res.headers.get('content-range') ?? '').split('/')[1]);
  return Number.isFinite(count) ? count + 1 : null;
}

/** The player's best score and rank in each mode they've played. */
export async function fetchPlayerRankings(name: string, hiddenLabel = ''): Promise<ModeRank[]> {
  if (!supabaseConfigured()) return [];
  const clean = safeDisplayName(name, hiddenLabel);

  const results = await Promise.all(
    RANKABLE_MODES.map(async (mode) => {
      const rows = await sbFetch<{ score: number }[]>(
        `scores?select=score&mode=eq.${encodeURIComponent(mode)}` +
          `&player=eq.${encodeURIComponent(clean)}&order=score.desc&limit=1`
      ).catch(() => null);
      const best = rows?.[0]?.score ?? 0;
      if (!best) return null;
      const rank = await countScoresAbove(mode, best).catch(() => null);
      return { mode, best, rank } satisfies ModeRank;
    })
  );

  return results.filter((r): r is ModeRank => r !== null);
}

// ---------- follows ----------

let followsCache: Set<string> | null = null;

export async function loadMyFollows(me: string, force = false): Promise<Set<string>> {
  if (!supabaseConfigured() || !me) return new Set();
  if (followsCache && !force) return followsCache;
  try {
    const rows = await sbFetch<{ followee: string }[]>(
      `follows?select=followee&follower=eq.${encodeURIComponent(me)}`
    );
    followsCache = new Set((rows ?? []).map((r) => r.followee));
  } catch {
    followsCache = new Set();
  }
  return followsCache;
}

export function isFollowing(name: string): boolean {
  return !!followsCache?.has(name);
}

export async function followPlayer(me: string, who: string): Promise<void> {
  if (!me || !who || me === who) return;
  (followsCache ??= new Set()).add(who);
  try {
    await sbFetch('follows', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{ follower: me, followee: who }])
    });
  } catch (err) {
    console.warn('follow failed:', err);
  }
}

export async function unfollowPlayer(me: string, who: string): Promise<void> {
  if (!me || !who) return;
  followsCache?.delete(who);
  try {
    await sbFetch(
      `follows?follower=eq.${encodeURIComponent(me)}&followee=eq.${encodeURIComponent(who)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
  } catch (err) {
    console.warn('unfollow failed:', err);
  }
}

// ---------- progress recording ----------

export interface RecordPlayInput {
  player: string;
  seconds: number;
  multiplayer: boolean;
  won: boolean;
  xp: number;
  perfect: boolean;
}

/**
 * Record a finished game. `record_progress` awards XP, updates the daily streak
 * and unlocks achievements atomically, returning what was newly unlocked so the
 * UI can celebrate it.
 */
export async function recordPlay(input: RecordPlayInput): Promise<string[]> {
  if (!supabaseConfigured() || !input.player) return [];
  try {
    const res = await sbFetch<{ new_achievements?: string[] }[] | { new_achievements?: string[] }>(
      'rpc/record_progress',
      {
        method: 'POST',
        body: JSON.stringify({
          p_player: input.player,
          p_seconds: Math.max(0, Math.round(input.seconds)),
          p_multiplayer: input.multiplayer,
          p_won: input.won,
          p_xp: Math.max(0, Math.round(input.xp)),
          p_perfect: input.perfect
        })
      }
    );
    const info = Array.isArray(res) ? res[0] : res;
    return Array.isArray(info?.new_achievements) ? info.new_achievements : [];
  } catch (err) {
    console.warn('record_progress failed:', err);
    return [];
  }
}
