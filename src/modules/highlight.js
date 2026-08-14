import { escapeHtml } from './util.js';

// ============================================================
//  Lightweight, language-agnostic syntax highlighter
// ============================================================
export const KEYWORDS = new Set([
    'def', 'class', 'return', 'import', 'from', 'as', 'with', 'async', 'await', 'lambda', 'for', 'in', 'if', 'elif',
    'else', 'while', 'print', 'None', 'True', 'False', 'not', 'and', 'or', 'is', 'pass', 'yield', 'try', 'except', 'finally',
    'const', 'let', 'var', 'function', '=>', 'new', 'export', 'default', 'document', 'console', 'typeof', 'this', 'null',
    'undefined', 'void', 'public', 'private', 'protected', 'static', 'final', 'class', 'interface', 'extends', 'implements',
    'package', 'main', 'func', 'go', 'defer', 'chan', 'map', 'struct', 'type', 'range', 'fn', 'let', 'mut', 'match', 'impl',
    'trait', 'use', 'pub', 'enum', 'where', 'include', 'template', 'typename', 'namespace', 'using', 'virtual', 'auto',
    'int', 'float', 'double', 'char', 'bool', 'string', 'String', 'vector', 'make_unique', 'throws', 'override', 'super'
]);

export function highlight(code) {
    // Token regex: comments, strings, numbers, identifiers, operators/punct.
    const tokenRe = /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*!?)|([{}()\[\];:,.<>+\-*/=&|?@%]+)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = tokenRe.exec(code)) !== null) {
        out += escapeHtml(code.slice(last, m.index));
        last = tokenRe.lastIndex;
        if (m[1]) {
            out += `<span class="tok-comment">${escapeHtml(m[1])}</span>`;
        } else if (m[2]) {
            out += `<span class="tok-string">${escapeHtml(m[2])}</span>`;
        } else if (m[3]) {
            out += `<span class="tok-number">${escapeHtml(m[3])}</span>`;
        } else if (m[4]) {
            const word = m[4];
            const after = code.slice(tokenRe.lastIndex, tokenRe.lastIndex + 1);
            if (KEYWORDS.has(word)) out += `<span class="tok-keyword">${escapeHtml(word)}</span>`;
            else if (after === '(') out += `<span class="tok-func">${escapeHtml(word)}</span>`;
            else out += escapeHtml(word);
        } else if (m[5]) {
            out += `<span class="tok-punct">${escapeHtml(m[5])}</span>`;
        }
    }
    out += escapeHtml(code.slice(last));
    return out;
}
