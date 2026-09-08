#!/usr/bin/env node
'use strict';
/*
 * Pre-flight the length-bias guard on a staged batch, before appending.
 *   node scripts/check-new-bias.js v3290-gamedev.json
 *
 * validate-questions.js reports bias for a WHOLE bank, so a bad batch shows up
 * as a couple of percentage points against hundreds of existing questions —
 * diluted enough to slip through while still making the bank worse. This runs
 * the same two rules over the new questions alone and names the offenders, so
 * they can be rewritten rather than averaged away.
 *
 * The rules, copied from scripts/validate-questions.js so they cannot drift:
 *   isUniqueLongest — the answer is strictly the longest option
 *   isLeaky         — (max - min) / mean > 0.6, so the gap is visible
 * A question is exploitable only when both hold: length alone points at it.
 *
 * It also checks the batch for CONTENT DUPLICATES against every existing bank,
 * on the same key validate-questions.js uses: normalised prompt + snippet. Most
 * questions carry an empty snippet, so the prompt alone has to be unique — and
 * short natural prompts like "What is a draw call?" collide readily. Finding
 * that here costs one run; finding it after appending means reverting the bank.
 */
const fs = require('fs');
const path = require('path');

const SPREAD_LEAK_RATIO = 0.6;
const file = process.argv[2];
if (!file) { console.error('usage: check-new-bias.js <file in scripts/new>'); process.exit(1); }

const qs = JSON.parse(fs.readFileSync(path.join(__dirname, 'new', file), 'utf8'));

// ---- content duplicates -----------------------------------------------------
const DATA = path.join(__dirname, '..', 'src', 'data');
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const keyOf = (q) => `${norm(q.question && q.question.en)}||${norm(q.codeSnippet)}`;

const seen = new Map(); // key -> "bank#id"
for (const f of fs.readdirSync(DATA).filter((n) => n.endsWith('.json'))) {
  const bank = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  if (!Array.isArray(bank)) continue;
  for (const q of bank) seen.set(keyOf(q), `${f}#${q.id}`);
}

const dupes = [];
const within = new Map();
for (const q of qs) {
  const k = keyOf(q);
  if (seen.has(k)) dupes.push([q.id, 'already in ' + seen.get(k)]);
  else if (within.has(k)) dupes.push([q.id, 'duplicates #' + within.get(k) + ' in this batch']);
  else within.set(k, q.id);
}
if (dupes.length) {
  console.log(`${file}: ${dupes.length} DUPLICATE prompt(s) — rewrite before appending:
`);
  for (const [id, where] of dupes) {
    const q = qs.find((x) => x.id === id);
    console.log(`   #${id}  ${where}
        ${(q.question && q.question.en) || '(no prompt)'}`);
  }
  process.exit(1);
}
console.log(`${file}: no duplicate prompts against ${seen.size} existing questions.`);
const mc = qs.filter((q) => Array.isArray(q.options));
if (!mc.length) { console.log(`${file}: no multiple-choice questions, nothing to check.`); process.exit(0); }

const bad = [];
let longest = 0;
let leaks = 0;
for (const q of mc) {
  const lens = q.options.map((o) => o.length);
  const max = Math.max(...lens);
  const min = Math.min(...lens);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const ansLen = String(q.answer).length;
  const isUniqueLongest = ansLen === max && lens.filter((l) => l === max).length === 1;
  const isLeaky = mean > 0 && (max - min) / mean > SPREAD_LEAK_RATIO;
  if (isUniqueLongest) longest++;
  if (isLeaky) leaks++;
  if (isUniqueLongest && isLeaky) {
    bad.push({ id: q.id, answer: q.answer, lens, spread: ((max - min) / mean).toFixed(2) });
  }
}

const pct = (n) => Math.round((100 * n) / mc.length);
console.log(`${file}: n=${mc.length}  EXPLOITABLE=${pct(bad.length)}%  (longest=${pct(longest)}%  leak=${pct(leaks)}%)`);
if (!bad.length) { console.log('  clean — no question is both the longest answer and a visible gap.'); process.exit(0); }
console.log('\n  Rewrite these so the answer is not the lone longest option:');
for (const b of bad) {
  console.log(`   #${b.id}  lens=[${b.lens.join(', ')}]  spread=${b.spread}\n        answer: ${b.answer}`);
}
process.exit(1);
