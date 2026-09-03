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
const MC_FILES = ['questions-cyber.json', 'questions-devops.json', 'questions-network.json', 'questions-gamedev.json', 'questions-bug.json', 'questions-output.json'];
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

// The app is English-only, so `en` is the only required text. Banks still carry `ar`
// as dormant data and new questions may add it, but nothing reads it — so it is
// optional. What is NOT allowed is a present-but-empty/non-string `ar`: that is a
// malformed field rather than an omitted one.
function textOk(o) {
  if (!o || typeof o.en !== 'string' || !o.en.trim()) return false;
  if (o.ar !== undefined && (typeof o.ar !== 'string' || !o.ar.trim())) return false;
  return true;
}

function checkCommon(file, q) {
  if (q.id == null) err(file, '?', 'missing id');
  if (!DIFFS.has(q.difficulty)) err(file, q.id, `bad difficulty "${q.difficulty}"`);
  if (!textOk(q.explanation)) err(file, q.id, 'explanation needs a non-empty en (ar optional, non-empty if present)');
  noteContent(file, q);
}

// ---- Content-duplicate detection --------------------------------------------
// `id` is only unique WITHIN a bank, so duplicate ids were the only thing this
// script used to catch — and 26 duplicate questions accumulated across four banks
// unnoticed (removed in v3.14.0 by scripts/remove-duplicates.js).
//
// Two questions are the same question when prompt AND snippet match. Neither half
// works alone: generic prompts are reused by design ("What is the output?" x58,
// "Which fix removes the bug?" x56), and 283 knowledge questions carry an empty
// codeSnippet. questions.json has no `question` field, so it keys on the snippet.
//
// The check spans every bank, not just each file: "All" mode mixes all eight banks
// into one round, so the same question in cyber and network would surface twice.
const normContent = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const seenContent = new Map(); // key -> ["file#id", ...]

function contentKey(q) {
  if (q.correctLanguage != null) return normContent(q.codeSnippet);
  return normContent(q.question && q.question.en) + '||' + normContent(q.codeSnippet);
}

function noteContent(file, q) {
  const key = contentKey(q);
  const where = `${file}#${q.id}`;
  const hits = seenContent.get(key);
  if (hits) hits.push(where);
  else seenContent.set(key, [where]);
}

function reportContentDuplicates() {
  const dups = [...seenContent.values()].filter((v) => v.length > 1);
  if (!dups.length) {
    console.log('\nNo duplicate questions (prompt + snippet, across all banks).');
    return;
  }
  console.error(`\nDuplicate questions (prompt + snippet), ${dups.length} group(s):`);
  for (const where of dups) {
    hardErrors++;
    console.error(`  ✗ ${where.join('  ==  ')}`);
  }
}

function analyzeMc(file, questions) {
  const ids = new Set();
  let longest = 0, leaks = 0, exploitable = 0, counted = 0;
  const perDiff = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) {
    if (ids.has(q.id)) err(file, q.id, 'duplicate id'); else ids.add(q.id);
    checkCommon(file, q);
    if (!textOk(q.question)) err(file, q.id, 'question needs a non-empty en (ar optional, non-empty if present)');
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

reportContentDuplicates();

if (hardErrors) { console.error(`\n${hardErrors} error(s).`); process.exit(1); }
if (strict && biasFail) { console.error('\nLength-bias targets exceeded (--strict).'); process.exit(1); }
console.log('\nOK.');
