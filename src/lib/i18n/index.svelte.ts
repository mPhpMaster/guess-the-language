import { I18N, type Lang, type TranslationKey } from './dictionary';
import type { Difficulty } from '$lib/game/types';

/** Keys whose value is a plain string — excludes the nested `diff` table. */
export type TextKey = {
  [K in TranslationKey]: (typeof I18N.en)[K] extends string ? K : never;
}[TranslationKey];

const STORAGE_KEY = 'gtl_lang';

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    /* private mode / disabled storage — fall through to the default */
  }
  return 'en';
}

/**
 * Language state. Reading `lang` (directly or through `t`) inside a component or
 * `$derived` subscribes it, so switching languages re-renders the whole tree —
 * this replaces the old `applyLanguage()` pass that walked `[data-i18n]` nodes.
 */
class I18nStore {
  #lang = $state<Lang>('en');

  constructor() {
    this.#lang = readStoredLang();
  }

  get lang(): Lang {
    return this.#lang;
  }

  set lang(next: Lang) {
    this.#lang = next === 'ar' ? 'ar' : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, this.#lang);
    } catch {
      /* not fatal — the language just won't persist */
    }
  }

  get dir(): 'rtl' | 'ltr' {
    return this.#lang === 'ar' ? 'rtl' : 'ltr';
  }

  get isRtl(): boolean {
    return this.#lang === 'ar';
  }

  /** Translate, falling back to English and finally to the key itself. */
  t = (key: TextKey): string => {
    const table = I18N[this.#lang] as Record<string, unknown>;
    const value = table[key];
    if (typeof value === 'string') return value;
    const fallback = (I18N.en as Record<string, unknown>)[key];
    return typeof fallback === 'string' ? fallback : key;
  };

  /** Localized difficulty label ("Easy" / "سهل"). */
  diffLabel = (d: Difficulty | string): string => {
    const table = I18N[this.#lang].diff as Record<string, string>;
    return table?.[d] ?? d;
  };

  /** Share text for a challenge link. */
  challengeText = (score: number): string =>
    this.#lang === 'ar'
      ? `حصلت على ${score} نقطة في لعبة "خمّن اللغة"! هل تستطيع التغلب عليّ؟`
      : `I scored ${score} points in "Guess the Language"! Can you beat me?`;

  /** Pick the right half of a bilingual field coming from the question banks. */
  pick = (value: Record<Lang, string> | string | undefined | null): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return value[this.#lang] ?? value.en ?? '';
  };
}

export const i18n = new I18nStore();

/** Convenience re-export so templates can call `t(...)` directly. */
export const t = i18n.t;

export type { Lang, TranslationKey };
