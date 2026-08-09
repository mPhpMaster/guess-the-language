import { describe, expect, it } from 'vitest';
import { AdaptivePicker } from './adaptive';
import type { Bank, RawQuestion } from './types';

function pool(counts: { easy: number; medium: number; hard: number }): RawQuestion[] {
  const out: RawQuestion[] = [];
  let id = 0;
  for (const [difficulty, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      out.push({ id: id++, bank: 'languages' as Bank, difficulty: difficulty as RawQuestion['difficulty'] });
    }
  }
  return out;
}

describe('AdaptivePicker', () => {
  it('starts easy', () => {
    const p = new AdaptivePicker(pool({ easy: 3, medium: 3, hard: 3 }));
    expect(p.target).toBe('easy');
    expect(p.next()?.difficulty).toBe('easy');
  });

  it('climbs on correct answers and falls on wrong ones', () => {
    const p = new AdaptivePicker(pool({ easy: 5, medium: 5, hard: 5 }));
    p.bump(true);
    expect(p.target).toBe('medium');
    p.bump(true);
    expect(p.target).toBe('hard');
    p.bump(true);
    expect(p.target).toBe('hard'); // clamps at the top
    p.bump(false);
    expect(p.target).toBe('medium');
    p.bump(false);
    expect(p.target).toBe('easy');
    p.bump(false);
    expect(p.target).toBe('easy'); // clamps at the bottom
  });

  it('never repeats a question', () => {
    const p = new AdaptivePicker(pool({ easy: 4, medium: 4, hard: 4 }));
    const seen = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const q = p.next();
      expect(q).not.toBeNull();
      expect(seen.has(q!.id)).toBe(false);
      seen.add(q!.id);
    }
  });

  it('degrades to a neighbouring difficulty when the target bucket is empty', () => {
    const p = new AdaptivePicker(pool({ easy: 0, medium: 2, hard: 0 }));
    expect(p.next()?.difficulty).toBe('medium');
  });

  it('buckets an unknown difficulty as medium rather than dropping it', () => {
    const odd = [{ id: 1, bank: 'languages' as Bank, difficulty: 'legendary' as never }];
    const p = new AdaptivePicker(odd);
    expect(p.next()?.id).toBe(1);
  });

  it('returns null once everything is exhausted', () => {
    const p = new AdaptivePicker([]);
    expect(p.next()).toBeNull();
  });
});
