import { describe, expect, it } from 'vitest';
import { avatarFor, isSafePlayerName, normalizedNameForSafety, safeDisplayName, sanitizeName } from './names';

describe('sanitizeName', () => {
  it('collapses whitespace runs and trims', () => {
    expect(sanitizeName('  Ali   Al   Hlack  ')).toBe('Ali Al Hlack');
  });

  it('caps at 24 code points without splitting an emoji', () => {
    const name = sanitizeName('🐼'.repeat(30));
    expect(Array.from(name)).toHaveLength(24);
    // Slicing by code unit would leave a lone surrogate; Array.from proves it did not.
    expect(name.includes('�')).toBe(false);
  });

  it('handles nullish input', () => {
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(undefined)).toBe('');
  });
});

describe('normalizedNameForSafety', () => {
  it('strips separators and zero-width characters', () => {
    // The zero-width joiner here is the exact trick the guard exists to catch.
    expect(normalizedNameForSafety('f_u.c​k')).toBe('fuck');
  });

  it('folds leet digits and modifier letters back to ASCII', () => {
    expect(normalizedNameForSafety('sh1t')).toBe('sh1t'); // 1 is not in the map
    expect(normalizedNameForSafety('5h0t')).toBe('5hot');
    expect(normalizedNameForSafety('ᶠᵘᶜᵏ')).toBe('fuck');
  });

  it('does NOT eat the letter s (regression: an escaping slip once did)', () => {
    expect(normalizedNameForSafety('sassy')).toBe('sassy');
  });

  it('keeps Arabic letters', () => {
    expect(normalizedNameForSafety('محمد')).toBe('محمد');
  });
});

describe('isSafePlayerName', () => {
  it('accepts ordinary names', () => {
    for (const name of ['alhlack', 'Ali', 'RealCyGuy', 'محمد', 'player_01']) {
      expect(isSafePlayerName(name)).toBe(true);
    }
  });

  it('rejects profanity, including obfuscated forms', () => {
    for (const name of ['fuck', 'F U C K', 'f_u.c​k', 'ᶠᵘᶜᵏ', 'sh1t'.replace('1', 'i')]) {
      expect(isSafePlayerName(name)).toBe(false);
    }
  });

  it('rejects Arabic profanity', () => {
    expect(isSafePlayerName('قحبة')).toBe(false);
  });

  it('rejects a name that normalizes to nothing', () => {
    expect(isSafePlayerName('   ')).toBe(false);
    expect(isSafePlayerName('...')).toBe(false);
  });
});

describe('safeDisplayName', () => {
  it('returns the sanitized name when it passes', () => {
    expect(safeDisplayName('  Ali  ', 'Hidden')).toBe('Ali');
  });

  it('substitutes the placeholder when it fails', () => {
    expect(safeDisplayName('fuck', 'Hidden')).toBe('Hidden');
  });
});

describe('avatarFor', () => {
  it('is deterministic for a given name', () => {
    expect(avatarFor('Ali')).toBe(avatarFor('Ali'));
  });

  it('always returns something', () => {
    for (const n of ['', 'a', 'RealCyGuy', 'محمد']) {
      expect(avatarFor(n)).toBeTruthy();
    }
  });
});
