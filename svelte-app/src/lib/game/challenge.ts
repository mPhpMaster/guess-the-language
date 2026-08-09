/**
 * Challenge links — pure payload encoding/decoding.
 *
 * Deliberately free of any browser or Discord dependency so it can be reasoned
 * about (and tested) on its own: everything here parses input that arrives from
 * a URL a stranger sent, so it validates rather than trusts.
 */

import { isModeId } from './constants';
import type { DifficultyFilter, ModeId } from './types';

/** Public origin used for challenge links and the share-card footer. */
export const GAME_PUBLIC_URL = 'https://guess-the-language-chi.vercel.app';

export interface Challenge {
  mode: ModeId | null;
  questions: number | null;
  difficulty: DifficultyFilter | null;
  score: number | null;
}

export function buildChallengePayload(input: {
  mode: ModeId;
  difficulty: DifficultyFilter;
  questions: number;
  score: number;
}): string {
  return [
    `m=${input.mode}`,
    `d=${input.difficulty}`,
    `q=${input.questions}`,
    `s=${Math.max(0, input.score | 0)}`
  ].join('&');
}

/** Parse a challenge payload back. Returns null when it carries nothing usable. */
export function parseChallengePayload(raw: unknown): Challenge | null {
  if (!raw || typeof raw !== 'string') return null;
  const out: Record<string, string> = {};
  for (const kv of raw.split('&')) {
    const [k, v] = kv.split('=');
    // An empty value counts as absent. The original kept it, which meant a
    // malformed "m=&s=" parsed as a real challenge with a score of 0 (because
    // Number('') is 0). Well-formed links always carry values, so tightening
    // this cannot change how any real challenge link behaves.
    if (k && v) out[k] = v;
  }
  const mode = out.m && isModeId(out.m) ? out.m : null;
  const questions = [5, 10, 15, 20].includes(Number(out.q)) ? Number(out.q) : null;
  const difficulty = (['all', 'easy', 'medium', 'hard'] as const).includes(
    out.d as DifficultyFilter
  )
    ? (out.d as DifficultyFilter)
    : null;
  const score = out.s !== undefined && Number.isFinite(Number(out.s)) ? Math.max(0, Number(out.s) | 0) : null;
  if (!mode && score == null) return null;
  return { mode, questions, difficulty, score };
}

export function getChallengeFromUrl(): Challenge | null {
  try {
    const p = new URLSearchParams(location.search).get('challenge');
    return p ? parseChallengePayload(decodeURIComponent(p)) : null;
  } catch {
    return null;
  }
}

export function buildChallengeUrl(payload: string): string {
  return `${GAME_PUBLIC_URL}/?challenge=${encodeURIComponent(payload)}`;
}
