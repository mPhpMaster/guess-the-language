import { describe, expect, it } from 'vitest';
import { buildRoundForRoom, normalizeCode, remainingSeconds, resolveQuestion, seededShuffle } from './round';
import type { Bank, RawQuestion } from '$lib/game/types';

/**
 * The original `src/multiplayer.js` implementation, copied verbatim.
 *
 * Rooms are shared between clients running different builds, so the seeded
 * shuffle MUST stay bit-identical: if the port drifted, two players in the same
 * room would see the same question with options in different positions, and the
 * server's answer key would grade the wrong one. Keeping the reference here lets
 * the test prove parity rather than assume it.
 */
function originalSeededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = arr.slice();
  let s = (Number(seed) >>> 0) || 1;
  function rand() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function q(id: number, bank: Bank, extra: Partial<RawQuestion> = {}): RawQuestion {
  return { id, bank, difficulty: 'easy', ...extra };
}

describe('seededShuffle parity with the original client', () => {
  const items = Array.from({ length: 24 }, (_, i) => i);

  it('matches the original for a spread of seeds', () => {
    for (const seed of [1, 2, 7, 42, 1337, 99999, 0x9e3779b9, 2 ** 31, 4294967295]) {
      expect(seededShuffle(items, seed)).toEqual(originalSeededShuffle(items, seed));
    }
  });

  it('matches for the degenerate seed 0 (both coerce to 1)', () => {
    expect(seededShuffle(items, 0)).toEqual(originalSeededShuffle(items, 0));
  });

  it('is deterministic across repeated calls', () => {
    expect(seededShuffle(items, 4242)).toEqual(seededShuffle(items, 4242));
  });

  it('actually permutes rather than returning the input order', () => {
    expect(seededShuffle(items, 4242)).not.toEqual(items);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    seededShuffle(input, 9);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildRoundForRoom', () => {
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => q(i, 'languages', { correctLanguage: 'Python' })),
    ...Array.from({ length: 10 }, (_, i) =>
      q(100 + i, 'cybersecurity', { options: ['a', 'b'], answer: 'a' })
    ),
    ...Array.from({ length: 10 }, (_, i) => q(200 + i, 'algorithms', { answer: '  Sqrt  ' }))
  ];

  const settings = { questions: 6, difficulty: 'all' as const, timer: 'auto' };

  it('emits one ref and one answer key per question, with matching indexes', () => {
    const { roundRefs, answerKeys } = buildRoundForRoom(pool, settings, 1_000_000);
    expect(roundRefs).toHaveLength(6);
    expect(answerKeys).toHaveLength(6);
    expect(answerKeys.map((k) => k.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('normalizes fill answers so the server grades what the client submits', () => {
    const { round, answerKeys } = buildRoundForRoom(pool, settings, 1_000_000);
    round.forEach((raw, i) => {
      if (raw.bank === 'algorithms') expect(answerKeys[i]!.answer).toBe('sqrt');
    });
  });

  it('uses the correct language as the key for language questions', () => {
    const { round, answerKeys } = buildRoundForRoom(pool, settings, 1_000_000);
    round.forEach((raw, i) => {
      if (raw.correctLanguage) expect(answerKeys[i]!.answer).toBe('Python');
    });
  });

  it('honours a fixed timer setting over the per-difficulty default', () => {
    const { roundRefs } = buildRoundForRoom(pool, { ...settings, timer: '30' }, 1_000_000);
    expect(roundRefs.every((r) => r.duration === 30)).toBe(true);
  });

  it('falls back to the per-difficulty duration on auto', () => {
    const { roundRefs } = buildRoundForRoom(pool, settings, 1_000_000);
    expect(roundRefs.every((r) => r.duration === 15)).toBe(true); // all easy
  });

  it('restricts the pool to the chosen mode', () => {
    const { round } = buildRoundForRoom(pool, { ...settings, mode: 'cybersecurity' }, 1_000_000);
    expect(round.every((r) => r.bank === 'cybersecurity')).toBe(true);
  });

  it('is reproducible for a given timestamp, so refs and keys line up', () => {
    const a = buildRoundForRoom(pool, settings, 555_000);
    const b = buildRoundForRoom(pool, settings, 555_000);
    expect(a.roundRefs).toEqual(b.roundRefs);
    expect(a.answerKeys).toEqual(b.answerKeys);
  });
});

describe('resolveQuestion', () => {
  const pool = [q(1, 'languages'), q(1, 'devops'), q(2, 'languages')];

  it('matches on bank AND id, not id alone', () => {
    const found = resolveQuestion({ bank: 'devops', id: 1, optionSeed: 1, duration: 10 }, pool);
    expect(found?.bank).toBe('devops');
  });

  it('returns null when the client lacks that question', () => {
    expect(resolveQuestion({ bank: 'gamedev', id: 99, optionSeed: 1, duration: 10 }, pool)).toBeNull();
  });
});

describe('normalizeCode', () => {
  it('upper-cases, strips punctuation and caps at four characters', () => {
    expect(normalizeCode(' ab-3d ')).toBe('AB3D');
    expect(normalizeCode('abcdefgh')).toBe('ABCD');
    expect(normalizeCode(null)).toBe('');
  });
});

describe('remainingSeconds', () => {
  it('is zero when there is no deadline', () => {
    expect(remainingSeconds(null)).toBe(0);
  });

  it('never goes negative once the deadline has passed', () => {
    expect(remainingSeconds(new Date(Date.now() - 60_000).toISOString())).toBe(0);
  });

  it('rounds up so the last partial second still shows', () => {
    expect(remainingSeconds(new Date(Date.now() + 4_200).toISOString())).toBe(5);
  });
});
