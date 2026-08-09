import type { Bank, Difficulty, RoundAnswer } from './types';

/**
 * Per-category accuracy for a finished round.
 *
 * Which axis is useful depends on the round: a mixed round (All / daily) spans
 * several banks, so grouping by bank tells the player *what* they are weak at; a
 * single-bank round groups by difficulty instead, which tells them *how far* they
 * get. Kept DOM-free so the grouping rule can be tested directly.
 */

export type BreakdownAxis = 'bank' | 'difficulty';

export interface BreakdownRow {
  /** A `Bank` when the axis is 'bank', a `Difficulty` when it is 'difficulty'. */
  key: Bank | Difficulty;
  correct: number;
  total: number;
  /** Rounded percentage, for the bar width. */
  pct: number;
  best: boolean;
  worst: boolean;
}

export interface Breakdown {
  axis: BreakdownAxis;
  rows: BreakdownRow[];
}

/**
 * Returns null when there is nothing worth drawing — fewer than two groups makes
 * a "comparison" of one bar, which is noise rather than insight.
 */
export function buildBreakdown(history: readonly RoundAnswer[]): Breakdown | null {
  if (!history.length) return null;

  const banks = new Set(history.map((h) => h.question.bank).filter(Boolean));
  const axis: BreakdownAxis = banks.size > 1 ? 'bank' : 'difficulty';
  const keyOf = (h: RoundAnswer) => (axis === 'bank' ? h.question.bank : h.question.difficulty);

  const groups = new Map<string, { correct: number; total: number }>();
  for (const item of history) {
    const key = keyOf(item);
    if (!key) continue;
    const group = groups.get(key) ?? { correct: 0, total: 0 };
    group.total += 1;
    if (item.correct) group.correct += 1;
    groups.set(key, group);
  }
  if (groups.size < 2) return null;

  const rows: BreakdownRow[] = [...groups.entries()]
    .map(([key, g]) => ({
      key: key as Bank | Difficulty,
      correct: g.correct,
      total: g.total,
      pct: Math.round((g.correct / g.total) * 100),
      best: false,
      worst: false
    }))
    .sort((a, b) => b.pct - a.pct);

  rows[0].best = true;
  // Only mark a worst when it is a different row — otherwise a single bar would
  // be flagged as both the strongest and the weakest area.
  const last = rows[rows.length - 1];
  if (last !== rows[0]) last.worst = true;

  return { axis, rows };
}
