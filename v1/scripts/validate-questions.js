#!/usr/bin/env node
'use strict';
/*
 * Question-bank validator + answer-length-bias guard.
 *
 * Multiple-choice banks must not let players "pick the longest option" — when the
 * correct answer is systematically the longest, the quiz is guessable. This script
 * checks schema integrity AND reports, per bank, how often the correct answer is the
 * uniquely longest option, and how many questions have a wide length spread (the
 * length actually leaks the answer). Run before every build.
 *
 *   node scripts/validate-questions.js          # report + exit 1 on schema errors
 *   node scripts/validate-questions.js --strict  # also exit 1 if bias exceeds targets
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'data');
const MC_FILES = ['questions-cyber.json', 'questions-devops.json', 'questions-network.json', 'questions-gamedev.json'];
const CHOICE_FILE = 'questions.json'; // guess-the-language (options generated at runtime)
const FILL_FILE = 'questions-algo.json';
const DIFFS = new Set(['easy', 'medium', 'hard']);

// A question "leaks" its answer by length when the spread between the longest and
// shortest option is large relative to the mean — length becomes a usable signal.
const SPREAD_LEAK_RATIO = 0.6; // (max-min)/mean above this → flagged

const strict = process.argv.includes('--strict');
let hardErrors = 0;
let biasFail = false;

function err(file, id, msg) { hardErrors++; console.error(`  ✗ ${file}#${id}: ${msg}`); }

function bilingualOk(o) { return o && typeof o.en === 'string' && o.en.trim() && typeof o.ar === 'string' && o.ar.trim(); }

function checkCommon(file, q) {
  if (q.id == null) err(file, '?', 'missing id');
  if (!DIFFS.has(q.difficulty)) err(file, q.id, `bad difficulty "${q.difficulty}"`);
  if (!bilingualOk(q.explanation)) err(file, q.id, 'explanation missing en/ar');
}

function analyzeMc(file, questions) {
  const ids = new Set();
  let longest = 0, leaks = 0, exploitable = 0, counted = 0;
  const perDiff = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) {
    if (ids.has(q.id)) err(file, q.id, 'duplicate id'); else ids.add(q.id);
    checkCommon(file, q);
    if (!bilingualOk(q.question)) err(file, q.id, 'question missing en/ar');
    if (!Array.isArray(q.options) || q.options.length < 3) { err(file, q.id, 'needs >= 3 options'); continue; }
    if (!q.options.includes(q.answer)) { err(file, q.id, `answer "${q.answer}" not in options`); continue; }
    if (new Set(q.options).size !== q.options.length) err(file, q.id, 'duplicate options');
    if (DIFFS.has(q.difficulty)) perDiff[q.difficulty]++;

    counted++;
    const lens = q.options.map((o) => o.length);
    const max = Math.max(...lens), min = Math.min(...lens);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const ansLen = String(q.answer).length;
    const isUniqueLongest = ansLen === max && lens.filter((l) => l === max).length === 1;
    const isLeaky = mean > 0 && (max - min) / mean > SPREAD_LEAK_RATIO;
    if (isUniqueLongest) longest++;
    if (isLeaky) leaks++;
    // The actual "pick the longest" exploit only works when the length gap is
    // visible AND the answer is that longest option. This is the metric to drive down.
    if (isUniqueLongest && isLeaky) exploitable++;
  }
  const pct = (n) => counted ? Math.round((100 * n) / counted) : 0;
  const flag = pct(exploitable) > 25 ? '🔴' : pct(exploitable) > 15 ? '🟠' : '🟢';
  console.log(`  ${flag} ${file}: n=${counted}  EXPLOITABLE(long+visible)=${pct(exploitable)}%  (longest=${pct(longest)}%  length-leak=${pct(leaks)}%)  [easy ${perDiff.easy}/med ${perDiff.medium}/hard ${perDiff.hard}]`);
  // Target: the exploitable share (visibly-longest correct answer) under 15%.
  if (pct(exploitable) > 15) biasFail = true;
}

console.log('Multiple-choice banks (length-bias guard):');
for (const f of MC_FILES) {
  const questions = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  analyzeMc(f, questions);
}

// Fill-in + guess-the-language: schema only (no fixed options to bias).
for (const f of [FILL_FILE, CHOICE_FILE]) {
  const questions = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const ids = new Set();
  for (const q of questions) {
    if (ids.has(q.id)) err(f, q.id, 'duplicate id'); else ids.add(q.id);
    checkCommon(f, q);
    if (f === FILL_FILE) {
      if (!q.answer) err(f, q.id, 'missing answer');
      // Runtime grades case/space-insensitively, so compare normalised.
      const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
      if (!Array.isArray(q.accept) || !q.accept.map(norm).includes(norm(q.answer))) err(f, q.id, 'answer not in accept[]');
    } else if (!q.correctLanguage) err(f, q.id, 'missing correctLanguage');
  }
  console.log(`  • ${f}: n=${questions.length} (schema only)`);
}

if (hardErrors) { console.error(`\n${hardErrors} schema error(s).`); process.exit(1); }
if (strict && biasFail) { console.error('\nLength-bias targets exceeded (--strict).'); process.exit(1); }
console.log('\nOK.');
