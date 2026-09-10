#!/usr/bin/env node
'use strict';
/*
 * One-off: rewrite 11 duplicate questions in place (v3.31.0).
 *   node scripts/rewrite-duplicates.js
 *
 * validate-questions.js keyed duplicates on prompt + snippet. In the Problem
 * Solving banks the prompt is boilerplate, so an identical snippet under
 * "What is printed?" and "What is the output?" passed as two questions. Seven
 * such copies came in with the v3.29.0 and v3.30.0 batches, and one more
 * (output#196) with the batch just before this release.
 * Three others were not textual copies but re-asked a concept a bank already
 * covers several times over.
 *
 * Each is rewritten under the SAME id rather than deleted, so no id is reused
 * and the bank counts stay put. Idempotent: it sets fields by id.
 */
const fs = require('fs');
const path = require('path');

const REWRITES = {
  'questions-algo.json': {
    // same snippet as algo#139
    259: { codeSnippet: '# capitalise the first letter of each word\nheading = text.____()', answer: 'title', accept: ['title', 'title()'],
      explanation: { en: 'str.title() uppercases the first letter of every word; capitalize() only touches the first character.' } }
  },
  'questions-output.json': {
    // same snippet as output#72
    155: { category: 'javascript', difficulty: 'easy', codeSnippet: 'console.log(typeof function () {});',
      options: ['function', 'object', 'undefined', 'string'], answer: 'function',
      explanation: { en: "Functions are objects, but typeof reports them separately as 'function'." } },
    // same snippet as bug#57
    166: { category: 'python', difficulty: 'medium', codeSnippet: 'a = [1, 2]\nb = a + [3]\nprint(a)',
      options: ['[1, 2]', '[1, 2, 3]', '[3]', 'Error'], answer: '[1, 2]',
      explanation: { en: '`+` builds a new list, so `a` is untouched — unlike `append`, which mutates in place.' } },
    // same snippet as output#77
    167: { category: 'python', difficulty: 'medium', codeSnippet: 'print([n * n for n in range(4)][1:3])',
      options: ['[1, 4]', '[0, 1]', '[4, 9]', '[1, 4, 9]'], answer: '[1, 4]',
      explanation: { en: 'The squares are [0, 1, 4, 9]; the slice [1:3] takes indices 1 and 2.' } },
    // same snippet as output#149
    179: { category: 'python', difficulty: 'easy', codeSnippet: "print('-'.join('abc'))",
      options: ['a-b-c', '-abc-', 'abc', 'a-bc'], answer: 'a-b-c',
      explanation: { en: 'A string is an iterable of characters, so join places the separator between each one.' } },
    // same snippet as output#65
    196: { category: 'python', difficulty: 'medium', codeSnippet: 'print(list(range(10, 0, -3)))',
      options: ['[10, 7, 4, 1]', '[10, 7, 4]', '[9, 6, 3]', '[10, 7, 4, 1, -2]'], answer: '[10, 7, 4, 1]',
      explanation: { en: 'The start is included and the stop never is; stepping by -3 from 10 reaches 1 and stops before 0.' } }
  },
  'questions-bug.json': {
    // same snippet as bug#141
    166: { category: 'python', difficulty: 'medium', codeSnippet: 'total = 0\nfor price in prices:\n    total =+ price',
      options: ['Swap `=+` for `+=`', 'Initialise total to 1', 'Cast price to int', 'Move total inside the loop'], answer: 'Swap `=+` for `+=`',
      explanation: { en: '`=+ price` parses as `= (+price)`, so each pass overwrites the total instead of adding to it.' } },
    // same snippet as bug#146
    187: { category: 'python', difficulty: 'medium', codeSnippet: "import os\npath = os.path.join('/data', '/logs')\nprint(path)",
      options: ['Drop the second leading slash', 'Use string concatenation', 'Call os.path.abspath first', 'Swap the two arguments'], answer: 'Drop the second leading slash',
      explanation: { en: "An absolute component discards everything before it, so the result is just '/logs'." } },
    // re-asked bug#7 (identifier casing)
    196: { category: 'javascript', difficulty: 'easy', codeSnippet: "const items = document.querySelectorAll('li');\nconst texts = items.map((li) => li.textContent);",
      options: ['Spread into an array first', 'Use getElementsByTagName', 'Query with querySelector', 'Wrap it in a try block'], answer: 'Spread into an array first',
      explanation: { en: 'A NodeList has forEach but no map; `[...items]` or Array.from gives a real array.' } },
    // re-asked the evaluated-once default, already bug#76, #111, #144, #157
    199: { category: 'python', difficulty: 'medium', codeSnippet: 'import math\ndef area(r):\n    return math.pi * r ^ 2',
      options: ['Use ** instead of ^', 'Import math at the top', 'Wrap r in float()', 'Round the result'], answer: 'Use ** instead of ^',
      explanation: { en: '`^` is bitwise XOR in Python, and XOR on a float raises TypeError; exponentiation is `**`.' } }
  },
  'questions-cyber.json': {
    // re-asked cyber#220 (what CORS does and does not do)
    243: { category: 'web', difficulty: 'medium', codeSnippet: '', question: { en: 'What does Subresource Integrity verify?' },
      options: ["A fetched file's hash", "The server's TLS chain", "The user's session token", "A cookie's signature"], answer: "A fetched file's hash",
      explanation: { en: 'The integrity attribute pins a hash, so a tampered CDN copy of the script is refused.' } }
  }
};

for (const [file, byId] of Object.entries(REWRITES)) {
  const p = path.join(__dirname, '..', 'src', 'data', file);
  const text = fs.readFileSync(p, 'utf8');
  const bank = JSON.parse(text);
  for (const [id, fields] of Object.entries(byId)) {
    const q = bank.find((x) => x.id === Number(id));
    if (!q) { console.error(`${file}#${id} not found`); process.exit(1); }
    Object.assign(q, fields);
  }
  // Keep the file's own indentation and trailing newline, so the diff is content only.
  const indent = (text.match(/^\[\r?\n([ \t]+)/) || [])[1] || 2;
  fs.writeFileSync(p, JSON.stringify(bank, null, indent) + (text.endsWith('\n') ? '\n' : ''));
  console.log(`${file}: rewrote ${Object.keys(byId).length} (${Object.keys(byId).map((i) => '#' + i).join(' ')})`);
}
