import { describe, expect, it } from 'vitest';
import { tokenize } from './highlight';

const joined = (code: string) => tokenize(code).map((t) => t.text).join('');
const kindsOf = (code: string, text: string) =>
  tokenize(code).filter((t) => t.text === text).map((t) => t.kind);

describe('tokenize', () => {
  it('is lossless — concatenating the tokens rebuilds the input exactly', () => {
    const samples = [
      "print('Hello, World!')",
      'const x = 1; // trailing comment',
      'def greet(name):\n    return "Hi " + name',
      '#include <stdio.h>\nint main() { return 0; }',
      'SELECT * FROM users WHERE id = 42;',
      ''
    ];
    for (const s of samples) expect(joined(s)).toBe(s);
  });

  it('classifies keywords, strings, numbers and comments', () => {
    expect(kindsOf('const x = 1;', 'const')).toEqual(['keyword']);
    expect(kindsOf('a = "hi"', '"hi"')).toEqual(['string']);
    expect(kindsOf('x = 42', '42')).toEqual(['number']);
    expect(kindsOf('x // note', '// note')).toEqual(['comment']);
    expect(kindsOf('# note', '# note')).toEqual(['comment']);
  });

  it('marks an identifier followed by ( as a function', () => {
    expect(kindsOf('greet(name)', 'greet')).toEqual(['func']);
    expect(kindsOf('greet + 1', 'greet')).toEqual(['plain']);
  });

  it('leaves markup as inert text rather than emitting HTML', () => {
    // The original built an HTML string; this returns data, so a bank containing
    // markup can never inject. The angle brackets stay literal characters.
    const code = '<img src=x onerror=alert(1)>';
    expect(joined(code)).toBe(code);
    expect(tokenize(code).every((t) => typeof t.text === 'string')).toBe(true);
  });

  it('is reusable — the shared regex is reset between calls', () => {
    const code = 'const a = 1; const b = 2;';
    expect(joined(code)).toBe(code);
    expect(joined(code)).toBe(code);
  });
});
