import { describe, expect, it } from 'vitest';
import {
  buildDailyRound,
  buildLanguageOptions,
  buildRoundFromPool,
  dailyDateKey,
  dailySeed,
  formatSeconds,
  isFillCorrect,
  normFill,
  normalizeQuestion,
  sampleAcrossBanks,
  scoreAnswer,
  timeForDifficulty
} from './round';
import type { Bank, Question, RawQuestion } from './types';

const pick = (v: unknown): string =>
  typeof v === 'string' ? v : ((v as Record<string, string> | undefined)?.en ?? '');

const normalizeOpts = { languagePrompt: 'Which language is this?', fillPrompt: 'Fill in the blank', pick };

function q(id: number, bank: Bank, extra: Partial<RawQuestion> = {}): RawQuestion {
  return { id, bank, difficulty: 'easy', ...extra };
}

describe('scoreAnswer', () => {
  it('pays 100 plus 10 per second remaining', () => {
    expect(scoreAnswer(0, 1)).toBe(100);
    expect(scoreAnswer(5, 1)).toBe(150);
  });

  it('applies the 1.5x multiplier from a 3-streak', () => {
    expect(scoreAnswer(0, 3)).toBe(150);
    expect(scoreAnswer(10, 3)).toBe(300);
  });

  it('never returns Infinity for a non-finite timer (the practice-mode trap)', () => {
    expect(scoreAnswer(Number.POSITIVE_INFINITY, 1)).toBe(100);
    expect(scoreAnswer(Number.NaN, 5)).toBe(150);
  });

  it('treats negative time left as zero', () => {
    expect(scoreAnswer(-8, 1)).toBe(100);
  });
});

describe('timeForDifficulty', () => {
  it('gives less time as difficulty rises', () => {
    expect(timeForDifficulty('easy')).toBe(15);
    expect(timeForDifficulty('medium')).toBe(14);
    expect(timeForDifficulty('hard')).toBe(12);
  });

  it('falls back to the easy allowance for anything unrecognised', () => {
    expect(timeForDifficulty('nonsense')).toBe(15);
  });
});

describe('sampleAcrossBanks', () => {
  // The whole reason this function exists: drawing uniformly meant ~45% of
  // 10-question "All" rounds contained no Problem Solving question at all.
  it('gives every bank a slot before any bank repeats', () => {
    const pool = [
      ...Array.from({ length: 200 }, (_, i) => q(i, 'languages')),
      ...Array.from({ length: 5 }, (_, i) => q(i, 'algorithms')),
      ...Array.from({ length: 5 }, (_, i) => q(i, 'devops'))
    ];
    for (let run = 0; run < 50; run++) {
      const banks = new Set(sampleAcrossBanks(pool, 3).map((x) => x.bank));
      expect(banks.size).toBe(3);
    }
  });

  it('does not balance a single-bank pool', () => {
    const pool = Array.from({ length: 20 }, (_, i) => q(i, 'languages'));
    expect(sampleAcrossBanks(pool, 5)).toHaveLength(5);
  });

  it('never returns more than the pool holds', () => {
    const pool = [q(1, 'languages'), q(2, 'devops')];
    expect(sampleAcrossBanks(pool, 10)).toHaveLength(2);
  });
});

describe('buildRoundFromPool', () => {
  const pool = [
    q(1, 'languages', { difficulty: 'easy' }),
    q(2, 'languages', { difficulty: 'hard' }),
    q(3, 'languages', { difficulty: 'hard' })
  ];

  it('filters by difficulty', () => {
    const round = buildRoundFromPool(pool, { questions: 5, difficulty: 'hard' });
    expect(round.every((x) => x.difficulty === 'hard')).toBe(true);
  });

  it('ignores the filter rather than returning an empty round', () => {
    const round = buildRoundFromPool(pool, { questions: 3, difficulty: 'medium' });
    expect(round).toHaveLength(3);
  });
});

describe('daily challenge', () => {
  const pool = Array.from({ length: 60 }, (_, i) => q(i, i % 2 ? 'languages' : 'devops'));

  it('is identical for every client on the same UTC day', () => {
    const day = new Date(Date.UTC(2026, 7, 9, 3, 0, 0));
    const later = new Date(Date.UTC(2026, 7, 9, 22, 30, 0));
    const a = buildDailyRound(pool, day).map((x) => `${x.bank}:${x.id}`);
    const b = buildDailyRound(pool, later).map((x) => `${x.bank}:${x.id}`);
    expect(a).toEqual(b);
  });

  it('is independent of the order the banks happened to load in', () => {
    const day = new Date(Date.UTC(2026, 7, 9));
    const shuffledPool = pool.slice().reverse();
    expect(buildDailyRound(pool, day).map((x) => x.id)).toEqual(
      buildDailyRound(shuffledPool, day).map((x) => x.id)
    );
  });

  it('changes when the UTC day rolls over', () => {
    const a = buildDailyRound(pool, new Date(Date.UTC(2026, 7, 9))).map((x) => x.id);
    const b = buildDailyRound(pool, new Date(Date.UTC(2026, 7, 10))).map((x) => x.id);
    expect(a).not.toEqual(b);
  });

  it('deals exactly ten questions', () => {
    expect(buildDailyRound(pool, new Date(Date.UTC(2026, 7, 9)))).toHaveLength(10);
  });

  it('derives the seed and key from UTC, not local time', () => {
    // 23:30 UTC on the 9th is already the 10th in +02:00 — must still be the 9th.
    const late = new Date(Date.UTC(2026, 7, 9, 23, 30));
    expect(dailyDateKey(late)).toBe('2026-08-09');
    expect(dailySeed(late)).toBe(20260809);
  });
});

describe('fill-in-the-blank grading', () => {
  const question = { answer: 'def', accept: ['define'] } as Question;

  it('normalizes case, padding and internal whitespace', () => {
    expect(normFill('  Hello   World ')).toBe('hello world');
    expect(normFill(null)).toBe('');
  });

  it('accepts the canonical answer and listed variants', () => {
    expect(isFillCorrect(question, '  DEF ')).toBe(true);
    expect(isFillCorrect(question, 'define')).toBe(true);
  });

  it('rejects empty and wrong answers', () => {
    expect(isFillCorrect(question, '   ')).toBe(false);
    expect(isFillCorrect(question, 'function')).toBe(false);
  });

  it('ignores the accept list in canonical-only (multiplayer) mode', () => {
    // Multiplayer grades canonical-only so the client agrees with the server.
    expect(isFillCorrect(question, 'define', true)).toBe(false);
    expect(isFillCorrect(question, 'def', true)).toBe(true);
  });
});

describe('normalizeQuestion', () => {
  it('detects a language question and offers four options including the answer', () => {
    const out = normalizeQuestion(
      q(1, 'languages', { correctLanguage: 'Python', codeSnippet: "print('x')" }),
      normalizeOpts
    );
    expect(out.style).toBe('languages');
    expect(out.answer).toBe('Python');
    expect(out.options).toHaveLength(4);
    expect(out.options.map((o) => o.label)).toContain('Python');
    expect(new Set(out.options.map((o) => o.label)).size).toBe(4);
    expect(out.panelIsCode).toBe(true);
  });

  it('detects a multiple-choice question and letters the options', () => {
    const out = normalizeQuestion(
      q(2, 'cybersecurity', {
        options: ['a', 'b', 'c', 'd'],
        answer: 'a',
        question: { en: 'What?', ar: 'ماذا؟' },
        codeSnippet: 'nmap -sS'
      }),
      normalizeOpts
    );
    expect(out.style).toBe('cyber');
    expect(out.options.map((o) => o.glyph)).toEqual(['A', 'B', 'C', 'D']);
    expect(out.panelText).toBe('nmap -sS');
    expect(out.questionText).toBe('What?');
  });

  it('puts the prompt in the panel when a choice question has no snippet', () => {
    const out = normalizeQuestion(
      q(3, 'network', { options: ['x', 'y'], answer: 'x', question: { en: 'DHCP does?', ar: '' } }),
      normalizeOpts
    );
    expect(out.panelIsCode).toBe(false);
    expect(out.panelText).toBe('DHCP does?');
    expect(out.questionText).toBe('');
  });

  it('falls back to a fill question and carries the accept list', () => {
    const out = normalizeQuestion(
      q(4, 'algorithms', { answer: 'sqrt', accept: ['sqrt'], codeSnippet: 'math.____(16)' }),
      normalizeOpts
    );
    expect(out.style).toBe('fill');
    expect(out.accept).toEqual(['sqrt']);
    expect(out.options).toEqual([]);
  });

  it('produces the same option order for every client given a shared seed', () => {
    const raw = q(5, 'languages', { correctLanguage: 'Rust' });
    const a = normalizeQuestion(raw, { ...normalizeOpts, optionSeed: 12345 });
    const b = normalizeQuestion(raw, { ...normalizeOpts, optionSeed: 12345 });
    expect(a.options.map((o) => o.label)).toEqual(b.options.map((o) => o.label));
  });
});

describe('buildLanguageOptions', () => {
  it('always includes the correct language even if it is not in the pool', () => {
    const opts = buildLanguageOptions('Brainfuck');
    expect(opts.map((o) => o.label)).toContain('Brainfuck');
    expect(opts).toHaveLength(4);
  });
});

describe('formatSeconds', () => {
  it('renders one decimal place', () => {
    expect(formatSeconds(2500)).toBe('2.5s');
  });

  it('renders an em dash when there is no figure', () => {
    expect(formatSeconds(Number.NaN)).toBe('—');
  });
});
