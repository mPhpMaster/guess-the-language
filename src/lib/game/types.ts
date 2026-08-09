/** Shared domain types for the quiz. */

import type { Lang } from '$lib/i18n/dictionary';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyFilter = Difficulty | 'all';

/** Bank ids map 1:1 to the JSON question files under `src/data`. */
export type Bank = 'languages' | 'cybersecurity' | 'devops' | 'network' | 'gamedev' | 'algorithms';

export type ModeId = Bank | 'all';

/** Bilingual text as it appears in the question JSON. */
export type Localized = Record<Lang, string>;

/**
 * A question exactly as it sits in the JSON banks. The three question styles are
 * distinguished by which fields are present, not by a discriminator field:
 *   `correctLanguage` -> pick the language; `options` -> multiple choice;
 *   neither -> fill in the blank.
 */
export interface RawQuestion {
  id: number;
  /** Attached at load time from the file the question came from. */
  bank?: Bank;
  category?: string;
  difficulty: Difficulty;
  codeSnippet?: string;
  correctLanguage?: string;
  question?: Localized;
  options?: string[];
  answer?: string;
  /** Accepted alternate spellings for fill-in answers. */
  accept?: string[];
  explanation?: Localized;
}

export type QuestionStyle = 'languages' | 'cyber' | 'fill';

export interface AnswerOption {
  label: string;
  /** Badge text/emoji — language questions only; choice options use a letter. */
  glyph?: string;
  /** CSS background for the badge. */
  color?: string;
}

/** A question normalized into one uniform render shape. */
export interface Question {
  id: number;
  bank: Bank;
  style: QuestionStyle;
  /** Text shown in the editor panel (a snippet, or the prompt when there is none). */
  panelText: string;
  panelIsCode: boolean;
  /** Prompt shown above the options; empty when the panel already carries it. */
  questionText: string;
  options: AnswerOption[];
  answer: string;
  accept: string[];
  difficulty: Difficulty;
  explanation?: Localized;
}

export interface LanguageMeta {
  name: string;
  /** Short badge text or emoji shown on the option button. */
  glyph: string;
  /** CSS background for the badge. */
  color: string;
}

export interface RoundAnswer {
  question: Question;
  chosen: string | null;
  correct: boolean;
  points: number;
  timedOut: boolean;
  /** Time taken to answer, clamped to the question's own time limit. */
  responseTimeMs: number;
}
