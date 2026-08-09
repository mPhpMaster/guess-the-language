import { t } from '../i18n';

/* ============================================================
   Display-name normalisation and safety screening.
   ============================================================ */

/**
 * Collapse whitespace runs, trim, and cap at 24 code points — so names padded
 * with spaces (or ending in a surrogate pair) aren't chopped mid-character and
 * still fit the leaderboard's 24-char limit.
 */
export function sanitizeName(raw: string | null | undefined): string {
    const collapsed = String(raw ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    return Array.from(collapsed).slice(0, 24).join('');
}

const BLOCKED_NAME_PATTERNS: readonly RegExp[] = [
    /fuck|fuk|shit|bitch|cunt|nigg|whore|porn|sex/,
    /نيك|كس|قحبة|شرموط|زب/,
];

const NAME_CONFUSABLES: Readonly<Record<string, string>> = {
    '0': 'o',
    '4': 'a',
    '3': 'e',
    '@': 'a',
    'ᶠ': 'f',
    'ᶸ': 'u',
    'ᶜ': 'c',
    'ᵏ': 'k',
    'ᵧ': 'y',
    'ₒ': 'o',
    'ᵤ': 'u',
    'ˢ': 's',
    'ʰ': 'h',
    'ⁱ': 'i',
    'ᵗ': 't',
    'ᵇ': 'b',
    'ⁿ': 'n',
    'ᵍ': 'g',
    'ʷ': 'w',
    'ʳ': 'r',
    'ᵖ': 'p',
    'ᵉ': 'e',
    'ˣ': 'x',
    'ᴜ': 'u',
    'γ': 'y',
};

function normalizedNameForSafety(raw: string): string {
    return sanitizeName(raw)
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[043@ᶠᶸᶜᵏᵧₒᵤˢʰⁱᵗᵇⁿᵍʷʳᵖᵉˣᴜγ]/g, (char) => NAME_CONFUSABLES[char] ?? char)
        .replace(/[​-‍﻿\s_.\-]+/g, '')
        .replace(/[^a-z0-9؀-ۿ]/g, '');
}

export function isSafePlayerName(raw: string): boolean {
    const normalized = normalizedNameForSafety(raw);
    return normalized.length > 0 && !BLOCKED_NAME_PATTERNS.some((re) => re.test(normalized));
}

/** The name to render publicly — masked when it fails the safety screen. */
export function safeDisplayName(raw: string | null | undefined): string {
    const name = sanitizeName(raw);
    return isSafePlayerName(name) ? name : t('hiddenPlayer');
}

/** Case-insensitive key used to match a player across leaderboard rows. */
export function nameKey(raw: string | null | undefined): string {
    return safeDisplayName(raw).trim().toLowerCase();
}

/** Normalise a typed fill-in answer so grading ignores case and spacing. */
export function normalizeFillAnswer(value: string | null | undefined): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}
