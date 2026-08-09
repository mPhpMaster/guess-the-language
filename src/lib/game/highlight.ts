/**
 * Lightweight, language-agnostic syntax highlighter.
 *
 * The original returned an HTML string that the renderer dropped into innerHTML.
 * Here it returns a token list instead, so the code panel renders through normal
 * Svelte markup — no `{@html}`, and therefore no XSS surface if a question bank
 * ever carries markup in a snippet.
 */

export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'func' | 'punct';

export interface Token {
  text: string;
  kind: TokenKind;
}

export const KEYWORDS: ReadonlySet<string> = new Set([
  'def', 'class', 'return', 'import', 'from', 'as', 'with', 'async', 'await', 'lambda', 'for', 'in', 'if', 'elif',
  'else', 'while', 'print', 'None', 'True', 'False', 'not', 'and', 'or', 'is', 'pass', 'yield', 'try', 'except',
  'finally', 'const', 'let', 'var', 'function', '=>', 'new', 'export', 'default', 'document', 'console', 'typeof',
  'this', 'null', 'undefined', 'void', 'public', 'private', 'protected', 'static', 'final', 'interface', 'extends',
  'implements', 'package', 'main', 'func', 'go', 'defer', 'chan', 'map', 'struct', 'type', 'range', 'fn', 'mut',
  'match', 'impl', 'trait', 'use', 'pub', 'enum', 'where', 'include', 'template', 'typename', 'namespace', 'using',
  'virtual', 'auto', 'int', 'float', 'double', 'char', 'bool', 'string', 'String', 'vector', 'make_unique', 'throws',
  'override', 'super'
]);

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*!?)|([{}()[\];:,.<>+\-*/=&|?@%]+)/g;

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (text) tokens.push({ text, kind });
  };

  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(code)) !== null) {
    push(code.slice(last, m.index), 'plain');
    last = TOKEN_RE.lastIndex;

    if (m[1]) push(m[1], 'comment');
    else if (m[2]) push(m[2], 'string');
    else if (m[3]) push(m[3], 'number');
    else if (m[4]) {
      const word = m[4];
      const nextChar = code.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 1);
      if (KEYWORDS.has(word)) push(word, 'keyword');
      else if (nextChar === '(') push(word, 'func');
      else push(word, 'plain');
    } else if (m[5]) push(m[5], 'punct');
  }

  push(code.slice(last), 'plain');
  return tokens;
}
