/** Display-name normalization and the profanity guard, ported verbatim. */

/**
 * Collapse whitespace runs to one space, trim, and cap at 24 code points — so a
 * name padded with spaces (or ending in an emoji) isn't chopped mid-character
 * and still fits the leaderboard's 24-char column.
 */
export function sanitizeName(raw: unknown): string {
  const collapsed = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(collapsed).slice(0, 24).join('');
}

const BLOCKED_NAME_PATTERNS: readonly RegExp[] = [
  /fuck|fuk|shit|bitch|cunt|nigg|whore|porn|sex/,
  /نيك|كس|قحبة|شرموط|زب/
];

/** Leet-speak and modifier-letter lookalikes folded back to plain ASCII. */
const NAME_CONFUSABLES: Readonly<Record<string, string>> = {
  '0': 'o', '4': 'a', '3': 'e', '@': 'a',
  'ᶠ': 'f', 'ᶸ': 'u', 'ᶜ': 'c', 'ᵏ': 'k', 'ᵧ': 'y', 'ₒ': 'o', 'ᵤ': 'u',
  'ˢ': 's', 'ʰ': 'h', 'ⁱ': 'i', 'ᵗ': 't', 'ᵇ': 'b', 'ⁿ': 'n', 'ᵍ': 'g',
  'ʷ': 'w', 'ʳ': 'r', 'ᵖ': 'p', 'ᵉ': 'e', 'ˣ': 'x', 'ᴜ': 'u', 'γ': 'y'
};

/**
 * Fold a name to a comparison form: strip decoration, zero-width characters and
 * separators so `f_u.c​k` and `ᶠᵘᶜᵏ` both collapse onto the same string.
 */
export function normalizedNameForSafety(raw: unknown): string {
  return sanitizeName(raw)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[043@ᶠᶸᶜᵏᵧₒᵤˢʰⁱᵗᵇⁿᵍʷʳᵖᵉˣᴜγ]/g, (c) => NAME_CONFUSABLES[c] ?? c)
    .replace(/[\u200B-\u200D\uFEFF\s_.\-]+/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

export function isSafePlayerName(raw: unknown): boolean {
  const normalized = normalizedNameForSafety(raw);
  return !!normalized && !BLOCKED_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** The name to show publicly, or a placeholder when it fails the guard. */
export function safeDisplayName(raw: unknown, hiddenLabel: string): string {
  const name = sanitizeName(raw);
  return isSafePlayerName(name) ? name : hiddenLabel;
}

/** Deterministic emoji avatar for players with no Discord photo. */
const AVATARS = ['🧑🏽', '👩🏼', '🧑🏻', '👩🏻‍🦰', '🧔🏽', '👨🏾', '👩🏽‍🦱', '🧑🏼‍🎤', '👨🏻‍💻', '👩🏾‍💻'] as const;

export function avatarFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[hash % AVATARS.length]!;
}
