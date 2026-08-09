import { describe, expect, it } from 'vitest';
import { buildChallengePayload, buildChallengeUrl, parseChallengePayload } from '$lib/game/challenge';

describe('challenge payload', () => {
  const input = { mode: 'cybersecurity' as const, difficulty: 'easy' as const, questions: 5, score: 750 };

  it('round-trips', () => {
    const parsed = parseChallengePayload(buildChallengePayload(input));
    expect(parsed).toEqual({ mode: 'cybersecurity', difficulty: 'easy', questions: 5, score: 750 });
  });

  it('survives a trip through a URL', () => {
    const url = buildChallengeUrl(buildChallengePayload(input));
    const encoded = new URL(url).searchParams.get('challenge');
    expect(parseChallengePayload(decodeURIComponent(encoded!))).toEqual({
      mode: 'cybersecurity',
      difficulty: 'easy',
      questions: 5,
      score: 750
    });
  });

  it('floors a negative score to zero', () => {
    expect(parseChallengePayload(buildChallengePayload({ ...input, score: -50 }))?.score).toBe(0);
  });

  // Everything below is untrusted input straight off a URL a stranger sent.
  it('rejects an unknown mode but keeps a usable score', () => {
    const parsed = parseChallengePayload('m=drop_tables&d=easy&q=5&s=100');
    expect(parsed?.mode).toBeNull();
    expect(parsed?.score).toBe(100);
  });

  it('rejects an out-of-range question count', () => {
    expect(parseChallengePayload('m=all&q=9999&s=10')?.questions).toBeNull();
  });

  it('rejects an unknown difficulty', () => {
    expect(parseChallengePayload('m=all&d=impossible&s=10')?.difficulty).toBeNull();
  });

  it('returns null for junk with nothing usable in it', () => {
    for (const junk of ['', 'nonsense', 'm=&s=', null, undefined, 42]) {
      expect(parseChallengePayload(junk)).toBeNull();
    }
  });

  it('ignores a non-numeric score rather than producing NaN', () => {
    const parsed = parseChallengePayload('m=all&s=abc');
    expect(parsed?.score).toBeNull();
  });
});
