import { createSignal } from 'solid-js';
import { en, type TranslationKey } from './en';
import { ar } from './ar';
import { LOCALES, type Difficulty, type GameMode, type Locale } from '../types/models';
import { readString, writeString } from '../lib/storage';

export type { TranslationKey };

const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<TranslationKey, string>>>> = {
    en,
    ar,
};

const STORAGE_KEY = 'gtl_lang';

function isLocale(value: string | null): value is Locale {
    return value !== null && (LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale {
    const stored = readString(STORAGE_KEY);
    return isLocale(stored) ? stored : 'en';
}

const [locale, setLocaleSignal] = createSignal<Locale>(readStoredLocale());

export { locale };

export function setLocale(next: Locale): void {
    writeString(STORAGE_KEY, next);
    setLocaleSignal(next);
    applyDocumentLocale(next);
}

export function isRtl(): boolean {
    return locale() === 'ar';
}

export function applyDocumentLocale(next: Locale = locale()): void {
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Translate a key, optionally substituting `{placeholders}`. Reading `locale()`
 * makes every call site reactive.
 */
export function t(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    const dict = DICTIONARIES[locale()];
    let text: string = dict[key] || en[key];
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.split(`{${name}}`).join(String(value));
        }
    }
    return text;
}

const MODE_KEYS: Readonly<Record<GameMode, TranslationKey>> = {
    languages: 'modeLanguages',
    cybersecurity: 'modeCyber',
    devops: 'modeDevops',
    network: 'modeNetwork',
    gamedev: 'modeGamedev',
    algorithms: 'modeAlgo',
    all: 'modeAll',
};

const MODE_DESC_KEYS: Readonly<Record<GameMode, TranslationKey>> = {
    languages: 'modeLanguagesDesc',
    cybersecurity: 'modeCyberDesc',
    devops: 'modeDevopsDesc',
    network: 'modeNetworkDesc',
    gamedev: 'modeGamedevDesc',
    algorithms: 'modeAlgoDesc',
    all: 'modeAllDesc',
};

const DIFFICULTY_KEYS: Readonly<Record<Difficulty, TranslationKey>> = {
    easy: 'diffEasy',
    medium: 'diffMedium',
    hard: 'diffHard',
};

export function modeLabel(mode: GameMode): string {
    return t(MODE_KEYS[mode]);
}

export function modeDescription(mode: GameMode): string {
    return t(MODE_DESC_KEYS[mode]);
}

export function difficultyLabel(difficulty: Difficulty): string {
    return t(DIFFICULTY_KEYS[difficulty]);
}
