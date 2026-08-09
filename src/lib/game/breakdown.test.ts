import { describe, expect, it } from 'vitest';
import { buildBreakdown } from './breakdown';
import type { Bank, Difficulty, Question, RoundAnswer } from './types';

function answer(bank: Bank, difficulty: Difficulty, correct: boolean): RoundAnswer {
  return {
    question: { bank, difficulty } as Question,
    chosen: correct ? 'a' : 'b',
    correct,
    points: correct ? 10 : 0,
    timedOut: false,
    responseTimeMs: 1000
  };
}

describe('buildBreakdown', () => {
  it('groups by bank when the round mixed several banks', () => {
    const b = buildBreakdown([
      answer('languages', 'easy', true),
      answer('languages', 'easy', false),
      answer('devops', 'easy', true)
    ]);
    expect(b?.axis).toBe('bank');
    expect(b?.rows.map((r) => r.key)).toEqual(['devops', 'languages']);
  });

  it('groups by difficulty when every question came from one bank', () => {
    const b = buildBreakdown([
      answer('languages', 'easy', true),
      answer('languages', 'hard', false)
    ]);
    expect(b?.axis).toBe('difficulty');
    expect(b?.rows.map((r) => r.key)).toEqual(['easy', 'hard']);
  });

  it('computes percentages and orders strongest first', () => {
    const b = buildBreakdown([
      answer('languages', 'easy', true),
      answer('languages', 'easy', true),
      answer('languages', 'hard', false),
      answer('languages', 'hard', true)
    ]);
    expect(b?.rows[0]).toMatchObject({ key: 'easy', pct: 100, correct: 2, total: 2, best: true });
    expect(b?.rows[1]).toMatchObject({ key: 'hard', pct: 50, worst: true });
  });

  it('returns null when there is only one group to compare', () => {
    expect(buildBreakdown([answer('languages', 'easy', true)])).toBeNull();
    expect(
      buildBreakdown([answer('languages', 'easy', true), answer('languages', 'easy', false)])
    ).toBeNull();
  });

  it('returns null for an empty round', () => {
    expect(buildBreakdown([])).toBeNull();
  });

  it('never marks the same row as both best and worst', () => {
    const b = buildBreakdown([
      answer('languages', 'easy', true),
      answer('languages', 'hard', true)
    ]);
    // Both at 100% — the leader is still the best, but neither is "the weakest".
    expect(b?.rows.filter((r) => r.best)).toHaveLength(1);
    expect(b?.rows.filter((r) => r.worst)).toHaveLength(1);
    expect(b?.rows.find((r) => r.best)).not.toBe(b?.rows.find((r) => r.worst));
  });
});
