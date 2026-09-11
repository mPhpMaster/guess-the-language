#!/usr/bin/env node
'use strict';
/*
 * Report NEAR-duplicate questions the exact-key guards cannot see.
 *   node scripts/find-near-duplicates.js [threshold]   (default 0.6)
 *
 * validate-questions.js keys on prompt + snippet (and, in the Problem Solving
 * banks, the snippet alone). That catches copies, not paraphrases: two knowledge
 * questions can ask the same thing in different words and both pass. This ranks
 * every pair by token overlap of (prompt + answer), and flags a same-answer pair
 * even at low overlap — a matching answer is a strong signal the concept repeats.
 *
 * It is advisory: near-duplicates are a judgement call (SMTP port 25 vs 587,
 * IPv4 32 bits vs IPv6 128 are NOT duplicates), so this never fails a build. Use
 * it to surface candidates, then decide. The v3.32.0 pass rewrote 32 confirmed
 * copies this way; scripts/new/v3320-dedup-map.json records exactly which.
 */
const fs = require('fs');
const path = require('path');

const THRESHOLD = Number(process.argv[2]) || 0.6;
const BANKS = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['cyber', 'devops', 'network', 'gamedev', 'bug', 'output'];

// Words too common to carry meaning; overlap on them is noise.
const STOP = new Set(('a an the is are what which does do of in to for on by with this that it its and or '
  + 'at as be from how why when used use most typically called default primarily').split(' '));
const toks = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\-/]+/g, ' ')
  .split(' ').filter((w) => w && !STOP.has(w)));
const jac = (x, y) => { let i = 0; for (const w of x) if (y.has(w)) i++; return i / (x.size + y.size - i || 1); };
const normA = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const all = [];
for (const b of BANKS) {
  const p = path.join(__dirname, '..', 'src', 'data', `questions-${b}.json`);
  for (const q of JSON.parse(fs.readFileSync(p, 'utf8'))) {
    if (!q.question) continue; // languages bank has no prompt
    all.push({ b, q, t: toks(q.question.en + ' ' + q.answer), a: normA(q.answer) });
  }
}

const pairs = [];
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const s = jac(all[i].t, all[j].t);
    const sameA = all[i].a === all[j].a && all[i].a.length > 0;
    // A shared answer is reported from a much lower overlap than an unrelated pair.
    if (s >= THRESHOLD || (sameA && s >= 0.3)) pairs.push([s, sameA, all[i], all[j]]);
  }
}
pairs.sort((p, q) => q[0] - p[0]);

for (const [s, sameA, x, y] of pairs) {
  console.log(`${s.toFixed(2)}${sameA ? ' =A' : '   '}  ${x.b}#${x.q.id}  ${x.q.question.en} -> ${x.q.answer}`);
  console.log(`           ${y.b}#${y.q.id}  ${y.q.question.en} -> ${y.q.answer}`);
}
console.log(`\n${pairs.length} candidate pair(s) at overlap >= ${THRESHOLD} (or same answer >= 0.30). Advisory only.`);
