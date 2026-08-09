import type { AnswerOption, LanguageMeta, ModeId } from './types';

/** The language pool. Each question shows the correct one plus rotating distractors. */
export const LANGUAGES: readonly LanguageMeta[] = [
  { name: 'Python', glyph: '🐍', color: 'linear-gradient(135deg,#4f8fc0,#2b5b87)' },
  { name: 'JavaScript', glyph: 'JS', color: 'linear-gradient(135deg,#f7df1e,#e0c500)' },
  { name: 'TypeScript', glyph: 'TS', color: 'linear-gradient(135deg,#4b8bf5,#2f6fdc)' },
  { name: 'C++', glyph: 'C++', color: 'linear-gradient(135deg,#6aa9e0,#2b69b3)' },
  { name: 'C', glyph: 'C', color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)' },
  { name: 'C#', glyph: 'C#', color: 'linear-gradient(135deg,#b07adf,#68217a)' },
  { name: 'Java', glyph: '☕', color: 'linear-gradient(135deg,#f89820,#c8442b)' },
  { name: 'Kotlin', glyph: 'Kt', color: 'linear-gradient(135deg,#c08cf5,#7f52ff)' },
  { name: 'Swift', glyph: '🐦', color: 'linear-gradient(135deg,#ff8f5e,#f05138)' },
  { name: 'Rust', glyph: '🦀', color: 'linear-gradient(135deg,#e8b18a,#b7560f)' },
  { name: 'Go', glyph: '🐹', color: 'linear-gradient(135deg,#7fd5ea,#00add8)' },
  { name: 'Ruby', glyph: '💎', color: 'linear-gradient(135deg,#e06b6b,#cc342d)' },
  { name: 'PHP', glyph: '🐘', color: 'linear-gradient(135deg,#8a93c8,#4F5B93)' },
  { name: 'SQL', glyph: '🗄️', color: 'linear-gradient(135deg,#5fc9d0,#2f8f96)' },
  { name: 'Bash', glyph: '🐚', color: 'linear-gradient(135deg,#8fd48f,#4e9a4e)' }
] as const;

const UNKNOWN_LANGUAGE_COLOR = 'linear-gradient(135deg,#8aa4bf,#4a6f8f)';

export function languageMeta(name: string): LanguageMeta {
  return LANGUAGES.find((l) => l.name === name) ?? { name, glyph: '?', color: UNKNOWN_LANGUAGE_COLOR };
}

/** Badge colours for A/B/C/D options in the non-language banks. */
export const OPTION_COLORS: readonly string[] = [
  'linear-gradient(135deg,#5fd0ff,#2b7fd8)',
  'linear-gradient(135deg,#19f0c4,#12a988)',
  'linear-gradient(135deg,#ffd874,#e0a83c)',
  'linear-gradient(135deg,#ff7a9c,#d8436c)'
] as const;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function choiceOption(label: string, index: number): AnswerOption {
  return {
    label,
    glyph: OPTION_LETTERS[index] ?? String(index + 1),
    color: OPTION_COLORS[index % OPTION_COLORS.length]!
  };
}

/** Radius 52 circle — used by the countdown ring's stroke-dasharray. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

/** Number of language choices shown per question (pool is larger). */
export const LANG_OPTION_COUNT = 4;

export const DAILY_QUESTION_COUNT = 10;

/** Mode ids in the order the home grid lays them out. */
export const MODE_IDS: readonly ModeId[] = [
  'languages',
  'cybersecurity',
  'devops',
  'network',
  'gamedev',
  'algorithms',
  'all'
] as const;

export function isModeId(value: string): value is ModeId {
  return (MODE_IDS as readonly string[]).includes(value);
}

/** `algorithms` is the only fill-in-the-blank bank; the rest are multiple choice. */
export const FILL_BANK: ModeId = 'algorithms';
