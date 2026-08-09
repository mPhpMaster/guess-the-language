import { isSafePlayerName, sanitizeName } from '$lib/game/names';
import { isDiscordLinked } from './discord.svelte';
import { fetchTopScores } from './leaderboard';
import { rpc, supabaseConfigured } from './supabase';

/**
 * Gate that runs before a round is allowed to start.
 *
 * Three layers, cheapest first: a local profanity/decoration check, then the
 * server's `is_safe_player_name` (the authoritative list), then a duplicate
 * check against the live board so two people don't share a leaderboard row.
 *
 * A Discord-linked player skips all of it — their name comes from Discord and
 * isn't theirs to choose here.
 */

export type NameProblem = 'required' | 'unsafe' | 'taken';

export interface NameCheck {
  valid: boolean;
  name: string;
  problem?: NameProblem;
}

export interface NameCheckOptions {
  /** The name currently entered. */
  candidate: string;
  /** Previously accepted name; re-using it skips the online checks. */
  previous?: string;
}

export async function ensureValidPlayerName(options: NameCheckOptions): Promise<NameCheck> {
  if (isDiscordLinked()) {
    return { valid: true, name: sanitizeName(options.candidate) };
  }

  const candidate = sanitizeName(options.candidate);
  if (!candidate) return { valid: false, name: '', problem: 'required' };
  if (!isSafePlayerName(candidate)) return { valid: false, name: '', problem: 'unsafe' };

  const lower = candidate.toLowerCase();
  const isReturningName = !!options.previous && lower === options.previous.trim().toLowerCase();

  if (supabaseConfigured() && !isReturningName) {
    try {
      const safe = await rpc<boolean>('is_safe_player_name', { p_name: candidate });
      if (safe !== true) return { valid: false, name: '', problem: 'unsafe' };

      const top = await fetchTopScores('all', 'all', 100);
      const taken = top.some((r) => String(r.player ?? '').trim().toLowerCase() === lower);
      if (taken) return { valid: false, name: '', problem: 'taken' };
    } catch (err) {
      // A leaderboard outage must not block play — the local check already passed.
      console.warn('Unable to verify leaderboard name availability:', err);
    }
  }

  return { valid: true, name: candidate };
}

/** i18n key for a rejection reason. */
export function nameProblemKey(problem: NameProblem): 'nameRequired' | 'unsafeName' | 'nameTaken' {
  if (problem === 'required') return 'nameRequired';
  if (problem === 'taken') return 'nameTaken';
  return 'unsafeName';
}
