import { LANGUAGES, OPTION_COLORS, UNKNOWN_LANGUAGE } from './languages';
import { locale, t } from '../i18n';
import { normalizeFillAnswer } from './names';
import {
    isChoiceQuestion,
    isLanguageQuestion,
    type AnswerOption,
    type BankedQuestion,
    type Difficulty,
    type GameSettings,
    type NormalizedQuestion,
    type QuestionBank,
} from '../types/models';

/* ============================================================
   Round construction, shuffling and question normalisation.
   ============================================================ */

export function shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = copy[i] as T;
        const b = copy[j] as T;
        copy[i] = b;
        copy[j] = a;
    }
    return copy;
}

/** Deterministic shuffle — identical output for every client given a seed. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
    const copy = items.slice();
    let state = (seed >>> 0) || 1;
    const rand = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const a = copy[i] as T;
        const b = copy[j] as T;
        copy[i] = b;
        copy[j] = a;
    }
    return copy;
}

function shuffleWithSeed<T>(items: readonly T[], seed: number | null): T[] {
    return seed === null ? shuffle(items) : seededShuffle(items, seed);
}

/** Number of language choices shown per question (the pool is larger). */
const LANG_OPTION_COUNT = 4;

/**
 * The correct language plus distractors, shuffled. `optionSeed` keeps the
 * selection identical for every player in a multiplayer round.
 */
export function buildLanguageOptions(
    correctName: string,
    optionSeed: number | null,
): readonly AnswerOption[] {
    const correct = LANGUAGES.find((l) => l.name === correctName) ?? {
        ...UNKNOWN_LANGUAGE,
        name: correctName,
    };
    const others = LANGUAGES.filter((l) => l.name !== correct.name);
    const distractors = shuffleWithSeed(others, optionSeed).slice(0, LANG_OPTION_COUNT - 1);
    const secondSeed = optionSeed === null ? null : (optionSeed ^ 0x9e37_79b9) >>> 0;
    return shuffleWithSeed([correct, ...distractors], secondSeed).map((lang) => ({
        label: lang.name,
        iconKey: lang.iconKey,
        color: lang.color,
    }));
}

export function scoreAnswer(timeLeft: number, streakAfter: number): number {
    const multiplier = streakAfter >= 3 ? 1.5 : 1;
    // Guard against a non-finite timeLeft (practice mode's ∞ timer) so the score
    // can never become Infinity.
    const seconds = Number.isFinite(timeLeft) ? Math.max(0, timeLeft) : 0;
    return Math.round((100 + 10 * seconds) * multiplier);
}

export function timeForDifficulty(difficulty: Difficulty): number {
    return difficulty === 'hard' ? 12 : difficulty === 'medium' ? 14 : 15;
}

/**
 * Seconds for a single-player question: the headless-test seam wins, then the
 * player's "Time per question" setting, else the per-difficulty default.
 */
export function resolvedQuestionTime(difficulty: Difficulty, settings: GameSettings): number {
    const seam = window.__GTL_QTIME;
    if (typeof seam === 'number' && seam > 0) return seam;
    if (settings.timer !== 'auto' && settings.timer > 0) return settings.timer;
    return timeForDifficulty(difficulty);
}

/**
 * Deal `count` questions round-robin across the banks present in the pool, so a
 * mixed round can't be swallowed by the biggest bank: one pass gives every bank
 * a slot before any bank repeats.
 */
export function sampleAcrossBanks<T extends { readonly bank?: QuestionBank }>(
    pool: readonly T[],
    count: number,
    shuffleFn: <U>(items: readonly U[]) => U[],
): T[] {
    const byBank = new Map<string, T[]>();
    for (const question of pool) {
        const bank = question.bank ?? 'languages';
        const bucket = byBank.get(bank);
        if (bucket) bucket.push(question);
        else byBank.set(bank, [question]);
    }
    if (byBank.size < 2) return shuffleFn(pool).slice(0, count);

    const queues = shuffleFn([...byBank.values()]).map((bucket) => shuffleFn(bucket));
    const picked: T[] = [];
    for (let depth = 0; picked.length < count; depth += 1) {
        let dealt = false;
        for (const queue of queues) {
            const item = queue[depth];
            if (item === undefined) continue;
            picked.push(item);
            dealt = true;
            if (picked.length === count) break;
        }
        if (!dealt) break; // every bank exhausted
    }
    return shuffleFn(picked);
}

export function buildRoundFromPool(
    pool: readonly BankedQuestion[],
    settings: GameSettings,
): readonly BankedQuestion[] {
    let filtered = pool;
    if (settings.difficulty !== 'all') {
        const byDifficulty = pool.filter((q) => q.difficulty === settings.difficulty);
        if (byDifficulty.length > 0) filtered = byDifficulty;
    }
    return sampleAcrossBanks(filtered, Math.min(settings.questions, filtered.length), shuffle);
}

/* ---------------- Adaptive difficulty (opt-in) ---------------- */

export interface AdaptiveState {
    target: Difficulty;
    readonly used: Set<string>;
    readonly pool: Record<Difficulty, BankedQuestion[]>;
}

export function createAdaptiveState(pool: readonly BankedQuestion[]): AdaptiveState {
    const buckets: Record<Difficulty, BankedQuestion[]> = { easy: [], medium: [], hard: [] };
    for (const question of pool) buckets[question.difficulty].push(question);
    return { target: 'easy', used: new Set<string>(), pool: buckets };
}

const PREFERENCE: Readonly<Record<Difficulty, readonly Difficulty[]>> = {
    easy: ['easy', 'medium', 'hard'],
    medium: ['medium', 'hard', 'easy'],
    hard: ['hard', 'medium', 'easy'],
};

function questionKey(question: BankedQuestion): string {
    return `${question.bank}|${question.id}`;
}

export function pickAdaptiveQuestion(state: AdaptiveState): BankedQuestion | null {
    for (const difficulty of PREFERENCE[state.target]) {
        const available = state.pool[difficulty].filter((q) => !state.used.has(questionKey(q)));
        const chosen = available[Math.floor(Math.random() * available.length)];
        if (chosen) {
            state.used.add(questionKey(chosen));
            return chosen;
        }
    }
    const all = [...state.pool.easy, ...state.pool.medium, ...state.pool.hard];
    const fallback = all.find((q) => !state.used.has(questionKey(q))) ?? all[0];
    if (fallback) state.used.add(questionKey(fallback));
    return fallback ?? null;
}

export function bumpAdaptive(state: AdaptiveState, correct: boolean): void {
    const up: Record<Difficulty, Difficulty> = { easy: 'medium', medium: 'hard', hard: 'hard' };
    const down: Record<Difficulty, Difficulty> = { hard: 'medium', medium: 'easy', easy: 'easy' };
    state.target = correct ? up[state.target] : down[state.target];
}

/* ---------------- Question normalisation ---------------- */

/**
 * Turn a raw question into a uniform render shape. The type is detected
 * per-question (by its fields) so "All" mode can mix every kind in one round.
 */
export function normalizeQuestion(
    question: BankedQuestion,
    optionSeed: number | null = null,
): NormalizedQuestion {
    const lang = locale();

    if (isLanguageQuestion(question)) {
        return {
            id: question.id,
            bank: question.bank,
            style: 'languages',
            panelText: question.codeSnippet ?? '',
            panelIsCode: true,
            questionText: t('langPrompt'),
            options: buildLanguageOptions(question.correctLanguage, optionSeed),
            answer: question.correctLanguage,
            accept: [],
            difficulty: question.difficulty,
            explanation: question.explanation,
        };
    }

    if (isChoiceQuestion(question)) {
        const hasCommand = (question.codeSnippet ?? '').trim().length > 0;
        return {
            id: question.id,
            bank: question.bank,
            style: 'choice',
            panelText: hasCommand ? (question.codeSnippet ?? '') : question.question[lang],
            panelIsCode: hasCommand,
            questionText: hasCommand ? question.question[lang] : '',
            options: shuffleWithSeed(question.options, optionSeed).map((label, index) => ({
                label,
                color: OPTION_COLORS[index % OPTION_COLORS.length] ?? OPTION_COLORS[0] ?? '',
            })),
            answer: question.answer,
            accept: [],
            difficulty: question.difficulty,
            explanation: question.explanation,
        };
    }

    return {
        id: question.id,
        bank: question.bank,
        style: 'fill',
        panelText: question.codeSnippet ?? '',
        panelIsCode: true,
        questionText: question.question[lang] || t('fillPrompt'),
        options: [],
        answer: question.answer,
        accept: question.accept ?? [],
        difficulty: question.difficulty,
        explanation: question.explanation,
    };
}

/**
 * Grade a fill-in-the-blank answer. Single-player also accepts the question's
 * `accept` variants; multiplayer uses canonical-only so it matches the server.
 */
export function isFillCorrect(
    question: NormalizedQuestion,
    typed: string,
    canonicalOnly = false,
): boolean {
    const normalized = normalizeFillAnswer(typed);
    if (!normalized) return false;
    if (normalized === normalizeFillAnswer(question.answer)) return true;
    if (canonicalOnly) return false;
    return question.accept.some((variant) => normalizeFillAnswer(variant) === normalized);
}
