import { createSignal } from 'solid-js';
import { isRecord, readString, writeJson, writeString } from './storage';
import { sanitizeName } from './names';
import type {
    DifficultyFilter,
    FeedbackDelay,
    GameSettings,
    QuestionCount,
    TimerSetting,
} from '../types/models';

const STORAGE_KEY = 'gtl_settings';

export const QUESTION_COUNTS: readonly QuestionCount[] = [5, 10, 15, 20];
export const TIMER_CHOICES: readonly TimerSetting[] = ['auto', 5, 10, 15, 20, 30, 45, 60];
export const FEEDBACK_DELAYS: readonly FeedbackDelay[] = [2, 4, 6, 'manual'];
export const DIFFICULTY_FILTERS: readonly DifficultyFilter[] = ['all', 'easy', 'medium', 'hard'];

export const DEFAULT_SETTINGS: GameSettings = {
    questions: 10,
    sound: true,
    difficulty: 'all',
    timer: 'auto',
    feedbackDelay: 4,
    name: '',
    adaptive: false,
    discordPresence: true,
};

function toQuestionCount(value: unknown): QuestionCount {
    const num = Number(value);
    return QUESTION_COUNTS.find((c) => c === num) ?? DEFAULT_SETTINGS.questions;
}

function toDifficultyFilter(value: unknown): DifficultyFilter {
    return DIFFICULTY_FILTERS.find((d) => d === value) ?? DEFAULT_SETTINGS.difficulty;
}

export function toTimerSetting(value: unknown): TimerSetting {
    if (value === 'auto') return 'auto';
    const num = Number(value);
    return TIMER_CHOICES.find((c) => c === num) ?? 'auto';
}

export function toFeedbackDelay(value: unknown): FeedbackDelay {
    if (value === 'manual') return 'manual';
    const num = Number(value);
    return num === 2 || num === 4 || num === 6 ? num : 4;
}

function parseSettings(value: unknown): GameSettings {
    if (!isRecord(value)) return DEFAULT_SETTINGS;
    return {
        questions: toQuestionCount(value['questions']),
        sound: value['sound'] !== false,
        difficulty: toDifficultyFilter(value['difficulty']),
        timer: toTimerSetting(value['timer']),
        feedbackDelay: toFeedbackDelay(value['feedbackDelay']),
        name: sanitizeName(typeof value['name'] === 'string' ? value['name'] : ''),
        adaptive: value['adaptive'] === true,
        discordPresence: value['discordPresence'] !== false,
    };
}

function loadSettings(): GameSettings {
    const raw = readString(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    try {
        return parseSettings(JSON.parse(raw));
    } catch {
        return DEFAULT_SETTINGS;
    }
}

const [settings, setSettingsSignal] = createSignal<GameSettings>(loadSettings());

export { settings };

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
    const next: GameSettings = { ...settings(), ...patch };
    writeJson(STORAGE_KEY, next);
    setSettingsSignal(next);
    return next;
}

/* ---------------- Per-mode high score ---------------- */

function highScoreKey(mode: string): string {
    return `gtl_highscore_${mode}`;
}

export function highScore(mode: string): number {
    const raw = readString(highScoreKey(mode));
    const value = Number(raw ?? 0);
    return Number.isFinite(value) ? value : 0;
}

export function setHighScore(mode: string, value: number): void {
    if (!Number.isFinite(value)) return; // never store Infinity/NaN
    writeString(highScoreKey(mode), String(value));
}
