/* ============================================================
   Lightweight, language-agnostic syntax highlighter.
   Produces typed tokens so the renderer never needs innerHTML.
   ============================================================ */

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'func' | 'punct';

export interface CodeToken {
    readonly kind: TokenKind;
    readonly text: string;
}

const KEYWORDS: ReadonlySet<string> = new Set([
    'def', 'class', 'return', 'import', 'from', 'as', 'with', 'async', 'await', 'lambda',
    'for', 'in', 'if', 'elif', 'else', 'while', 'print', 'None', 'True', 'False', 'not',
    'and', 'or', 'is', 'pass', 'yield', 'try', 'except', 'finally', 'const', 'let', 'var',
    'function', 'new', 'export', 'default', 'document', 'console', 'typeof', 'this', 'null',
    'undefined', 'void', 'public', 'private', 'protected', 'static', 'final', 'interface',
    'extends', 'implements', 'package', 'main', 'func', 'go', 'defer', 'chan', 'map',
    'struct', 'type', 'range', 'fn', 'mut', 'match', 'impl', 'trait', 'use', 'pub', 'enum',
    'where', 'include', 'template', 'typename', 'namespace', 'using', 'virtual', 'auto',
    'int', 'float', 'double', 'char', 'bool', 'string', 'String', 'vector', 'make_unique',
    'throws', 'override', 'super',
]);

const TOKEN_RE =
    /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*!?)|([{}()[\];:,.<>+\-*/=&|?@%]+)/g;

export function tokenizeCode(code: string): readonly CodeToken[] {
    const tokens: CodeToken[] = [];
    let last = 0;
    TOKEN_RE.lastIndex = 0;

    let match = TOKEN_RE.exec(code);
    while (match !== null) {
        if (match.index > last) {
            tokens.push({ kind: 'plain', text: code.slice(last, match.index) });
        }
        last = TOKEN_RE.lastIndex;

        const [, comment, str, num, word, punct] = match;
        if (comment !== undefined) {
            tokens.push({ kind: 'comment', text: comment });
        } else if (str !== undefined) {
            tokens.push({ kind: 'string', text: str });
        } else if (num !== undefined) {
            tokens.push({ kind: 'number', text: num });
        } else if (word !== undefined) {
            const nextChar = code.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 1);
            const kind: TokenKind = KEYWORDS.has(word)
                ? 'keyword'
                : nextChar === '('
                  ? 'func'
                  : 'plain';
            tokens.push({ kind, text: word });
        } else if (punct !== undefined) {
            tokens.push({ kind: 'punct', text: punct });
        }
        match = TOKEN_RE.exec(code);
    }

    if (last < code.length) tokens.push({ kind: 'plain', text: code.slice(last) });
    return tokens;
}

export const TOKEN_CLASS: Readonly<Record<TokenKind, string>> = {
    plain: '',
    comment: 'tok-comment',
    string: 'tok-string',
    number: 'tok-number',
    keyword: 'tok-keyword',
    func: 'tok-func',
    punct: 'tok-punct',
};
