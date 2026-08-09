import { LANG_OPTION_COUNT, LANGUAGES, OPTION_COLORS, OPTION_LETTERS, languageMeta } from './constants';
import type { AnswerOption, Difficulty, DifficultyFilter, Question, RawQuestion } from './types';

/** Fisher–Yates on a copy. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Deterministic PRNG — every client derives the identical daily set from it. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Shuffle that a multiplayer round can reproduce. With a seed every client
 * derives the same order, so all players see options in the same positions.
 */
export function shuffleOptions<T>(arr: readonly T[], optionSeed?: number | null): T[] {
  if (optionSeed != null) return seededShuffle(arr, mulberry32(optionSeed));
  return shuffle(arr);
}

/** The correct language plus rotating distractors, shuffled. */
export function buildLanguageOptions(correctName: string, optionSeed?: number | null): AnswerOption[] {
  const correct = languageMeta(correctName);
  const others = LANGUAGES.filter((l) => l.name !== correct.name);
  const distractors = shuffleOptions(others, optionSeed).slice(0, LANG_OPTION_COUNT - 1);
  // A second, differently-derived seed so the final order isn't a rotation of the pick.
  const seed2 = optionSeed != null ? (optionSeed ^ 0x9e3779b9) >>> 0 : null;
  return shuffleOptions([correct, ...distractors], seed2).map((l) => ({
    label: l.name,
    glyph: l.glyph,
    color: l.color
  }));
}

/** Points for a correct answer; a 3+ streak pays 1.5x. */
export function scoreAnswer(timeLeft: number, streakAfter: number): number {
  const multiplier = streakAfter >= 3 ? 1.5 : 1;
  // Practice mode runs an infinite timer — never let that become an Infinity score.
  const t = Number.isFinite(timeLeft) ? Math.max(0, timeLeft) : 0;
  return Math.round((100 + 10 * t) * multiplier);
}

export function timeForDifficulty(d: Difficulty | string): number {
  return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

/**
 * Deal `count` questions round-robin across the banks present in the pool.
 * Drawing uniformly used to mean ~45% of 10-question "All" rounds contained no
 * Problem Solving question at all, because `languages` alone is over half the
 * pool. One pass gives every bank a slot before any bank repeats.
 */
export function sampleAcrossBanks<T extends { bank?: string }>(
  pool: readonly T[],
  count: number,
  shuffleFn: <U>(a: readonly U[]) => U[] = shuffle
): T[] {
  const byBank = new Map<string, T[]>();
  for (const q of pool) {
    const bank = q.bank || 'languages';
    const list = byBank.get(bank);
    if (list) list.push(q);
    else byBank.set(bank, [q]);
  }
  // Single-bank pool (any specific mode): nothing to balance.
  if (byBank.size < 2) return shuffleFn(pool).slice(0, count);

  const queues = shuffleFn(Array.from(byBank.values())).map((qs) => shuffleFn(qs));
  const picked: T[] = [];
  for (let depth = 0; picked.length < count; depth++) {
    let dealt = false;
    for (const queue of queues) {
      if (depth >= queue.length) continue;
      picked.push(queue[depth]!);
      dealt = true;
      if (picked.length === count) break;
    }
    if (!dealt) break; // every bank exhausted
  }
  return shuffleFn(picked);
}

export interface RoundOptions {
  questions: number;
  difficulty: DifficultyFilter;
}

export function buildRoundFromPool(pool: readonly RawQuestion[], options: RoundOptions): RawQuestion[] {
  let filtered: readonly RawQuestion[] = pool;
  if (options.difficulty !== 'all') filtered = pool.filter((q) => q.difficulty === options.difficulty);
  if (filtered.length === 0) filtered = pool;
  return sampleAcrossBanks(filtered, Math.min(options.questions, filtered.length));
}

// ---------- Daily challenge ----------

export const DAILY_QUESTION_COUNT = 10;

/** Integer seed from the UTC date, so the day flips at 00:00 UTC worldwide. */
export function dailySeed(now: Date = new Date()): number {
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

export function dailyDateKey(now: Date = new Date()): string {
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${now.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * The same ten questions for everyone, every day. Sorted by a stable (bank, id)
 * key first so the pick is identical on every client regardless of load order.
 */
export function buildDailyRound(pool: readonly RawQuestion[], now: Date = new Date()): RawQuestion[] {
  const stable = pool
    .slice()
    .sort((a, b) => String(a.bank).localeCompare(String(b.bank)) || Number(a.id) - Number(b.id));
  return seededShuffle(stable, mulberry32(dailySeed(now))).slice(0, DAILY_QUESTION_COUNT);
}

// ---------- Fill-in-the-blank grading ----------

export function normFill(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Grade a typed answer. Single-player also accepts the question's `accept`
 * variants; multiplayer grades canonical-only so it matches the server.
 */
export function isFillCorrect(question: Question, typed: string, canonicalOnly = false): boolean {
  const n = normFill(typed);
  if (!n) return false;
  if (n === normFill(question.answer)) return true;
  if (canonicalOnly) return false;
  return question.accept.some((a) => normFill(a) === n);
}

// ---------- Normalization ----------

export interface NormalizeOptions {
  optionSeed?: number | null;
  /** Fallback bank for choice questions that don't carry one. */
  fallbackBank?: Question['bank'];
  /** Prompt shown for language questions ("Which language is this?"). */
  languagePrompt: string;
  /** Prompt shown for fill questions with no question text. */
  fillPrompt: string;
  /** Resolves a bilingual field to the active language. */
  pick: (v: Record<string, string> | string | undefined | null) => string;
}

/**
 * Turn a raw bank entry into one uniform render shape. The style is detected per
 * question by which fields are present, so "All" mode can mix every kind in a
 * single round.
 */
export function normalizeQuestion(q: RawQuestion, opts: NormalizeOptions): Question {
  const optionSeed = opts.optionSeed ?? null;

  if (q.correctLanguage) {
    return {
      id: q.id,
      bank: q.bank ?? 'languages',
      style: 'languages',
      panelText: q.codeSnippet ?? '',
      panelIsCode: true,
      questionText: opts.languagePrompt,
      options: buildLanguageOptions(q.correctLanguage, optionSeed),
      answer: q.correctLanguage,
      accept: [],
      difficulty: q.difficulty,
      explanation: q.explanation
    };
  }

  if (Array.isArray(q.options) && q.answer != null) {
    const hasCmd = !!q.codeSnippet?.trim();
    const prompt = opts.pick(q.question);
    return {
      id: q.id,
      bank: q.bank ?? opts.fallbackBank ?? 'cybersecurity',
      style: 'cyber',
      panelText: hasCmd ? (q.codeSnippet ?? '') : prompt,
      panelIsCode: hasCmd,
      questionText: hasCmd ? prompt : '',
      options: shuffleOptions(q.options, optionSeed).map((label, i) => ({
        label,
        glyph: OPTION_LETTERS[i] ?? String(i + 1),
        color: OPTION_COLORS[i % OPTION_COLORS.length]
      })),
      answer: q.answer,
      accept: [],
      difficulty: q.difficulty,
      explanation: q.explanation
    };
  }

  // Fill-in-the-blank / code completion.
  return {
    id: q.id,
    bank: q.bank ?? 'algorithms',
    style: 'fill',
    panelText: q.codeSnippet ?? '',
    panelIsCode: true,
    questionText: q.question ? opts.pick(q.question) : opts.fillPrompt,
    options: [],
    answer: q.answer ?? '',
    accept: Array.isArray(q.accept) ? q.accept : [],
    difficulty: q.difficulty,
    explanation: q.explanation
  };
}

/** "1.4s", or an em dash when there is no meaningful figure. */
export function formatSeconds(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}
