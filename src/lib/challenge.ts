import { GAME_MODES, type ChallengeInfo, type DifficultyFilter, type GameMode, type QuestionCount } from '../types/models';
import { QUESTION_COUNTS, DIFFICULTY_FILTERS } from './settings';
import { shareBaseUrl } from './platform';
import { locale } from '../i18n';

/* ============================================================
   Challenge deep links — a compact custom_id (max 64 chars)
   carried by a Discord share or a ?challenge= web URL.
   Example: "m=gamedev&d=hard&q=10&s=570".
   ============================================================ */

export function buildChallengePayload(
    mode: GameMode,
    difficulty: DifficultyFilter,
    questions: QuestionCount,
    score: number,
): string {
    return [
        `m=${mode}`,
        `d=${difficulty}`,
        `q=${questions}`,
        `s=${Math.max(0, Math.trunc(score))}`,
    ].join('&');
}

export function parseChallengePayload(raw: string | null | undefined): ChallengeInfo | null {
    if (!raw) return null;
    const parts = new Map<string, string>();
    for (const chunk of raw.split('&')) {
        const [key, value] = chunk.split('=');
        if (key && value !== undefined) parts.set(key, value);
    }

    const rawMode = parts.get('m');
    const mode = GAME_MODES.find((m) => m === rawMode) ?? null;
    const questions = QUESTION_COUNTS.find((c) => c === Number(parts.get('q'))) ?? null;
    const difficulty = DIFFICULTY_FILTERS.find((d) => d === parts.get('d')) ?? null;
    const rawScore = Number(parts.get('s'));
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.trunc(rawScore)) : null;

    if (!mode && score === null) return null;
    return { mode, questions, difficulty, score };
}

/** Read a challenge off the web URL (`?challenge=<payload>`). */
export function challengeFromUrl(): ChallengeInfo | null {
    try {
        const raw = new URLSearchParams(window.location.search).get('challenge');
        return raw ? parseChallengePayload(decodeURIComponent(raw)) : null;
    } catch {
        return null;
    }
}

/** A shareable link that opens the game preloaded with this challenge. */
export function buildChallengeUrl(payload: string): string {
    const base = shareBaseUrl().replace(/\/+$/, '/');
    return `${base}?challenge=${encodeURIComponent(payload)}`;
}

export function challengeMessage(score: number): string {
    return locale() === 'ar'
        ? `حصلت على ${score} نقطة في لعبة "خمّن اللغة"! هل تستطيع التغلب عليّ؟`
        : `I scored ${score} points in "Guess the Language"! Can you beat me?`;
}
