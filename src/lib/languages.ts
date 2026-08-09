/**
 * The answer pool for "guess the language" questions. `iconKey` maps into the
 * brand-icon registry in components/icons.tsx — no emoji anywhere.
 */
export interface LanguageOption {
    readonly name: string;
    readonly iconKey: string;
    readonly color: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
    { name: 'Python', iconKey: 'python', color: 'linear-gradient(135deg,#4f8fc0,#2b5b87)' },
    { name: 'JavaScript', iconKey: 'javascript', color: 'linear-gradient(135deg,#f7df1e,#e0c500)' },
    { name: 'TypeScript', iconKey: 'typescript', color: 'linear-gradient(135deg,#4b8bf5,#2f6fdc)' },
    { name: 'C++', iconKey: 'cplusplus', color: 'linear-gradient(135deg,#6aa9e0,#2b69b3)' },
    { name: 'C', iconKey: 'c', color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)' },
    { name: 'C#', iconKey: 'csharp', color: 'linear-gradient(135deg,#b07adf,#68217a)' },
    { name: 'Java', iconKey: 'java', color: 'linear-gradient(135deg,#f89820,#c8442b)' },
    { name: 'Kotlin', iconKey: 'kotlin', color: 'linear-gradient(135deg,#c08cf5,#7f52ff)' },
    { name: 'Swift', iconKey: 'swift', color: 'linear-gradient(135deg,#ff8f5e,#f05138)' },
    { name: 'Rust', iconKey: 'rust', color: 'linear-gradient(135deg,#e8b18a,#b7560f)' },
    { name: 'Go', iconKey: 'go', color: 'linear-gradient(135deg,#7fd5ea,#00add8)' },
    { name: 'Ruby', iconKey: 'ruby', color: 'linear-gradient(135deg,#e06b6b,#cc342d)' },
    { name: 'PHP', iconKey: 'php', color: 'linear-gradient(135deg,#8a93c8,#4F5B93)' },
    { name: 'SQL', iconKey: 'sql', color: 'linear-gradient(135deg,#5fc9d0,#2f8f96)' },
    { name: 'Bash', iconKey: 'bash', color: 'linear-gradient(135deg,#8fd48f,#4e9a4e)' },
];

export const UNKNOWN_LANGUAGE: LanguageOption = {
    name: '',
    iconKey: 'unknown',
    color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)',
};

/** Badge colours for A/B/C/D multiple-choice options. */
export const OPTION_COLORS: readonly string[] = [
    'linear-gradient(135deg,#5fd0ff,#2b7fd8)',
    'linear-gradient(135deg,#19f0c4,#12a988)',
    'linear-gradient(135deg,#ffd874,#e0a83c)',
    'linear-gradient(135deg,#ff7a9c,#d8436c)',
];
