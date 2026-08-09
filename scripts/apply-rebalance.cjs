#!/usr/bin/env node
'use strict';
/*
 * Apply a distractor-rebalance map to a multiple-choice bank.
 *
 * The map is { "<id>": ["distractorA","distractorB","distractorC"] }. For each id we
 * rebuild options as [correctAnswer, ...distractors] — the correct answer is taken
 * verbatim from the bank (never retyped), so it always stays valid; only the wrong
 * options change. The runtime shuffles option order, so we don't randomise here.
 * Goal: all four options read as parallel, similar-length choices, killing the
 * "the longest option is the answer" tell.
 *
 *   node scripts/apply-rebalance.js questions-devops.json questions-devops.json
 *   (first arg = bank file in src/data, second = map file in scripts/rebalance)
 */
const fs = require('fs');
const path = require('path');

const [, , bankFile, mapFile] = process.argv;
if (!bankFile || !mapFile) { console.error('usage: apply-rebalance.js <bankFile> <mapFile>'); process.exit(1); }

const bankPath = path.join(__dirname, '..', 'src', 'data', bankFile);
const mapPath = path.join(__dirname, 'rebalance', mapFile);
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

let applied = 0;
for (const q of bank) {
  const distractors = map[String(q.id)];
  if (!distractors) continue;
  if (!Array.isArray(distractors) || distractors.length < 3) { console.error(`id ${q.id}: need >= 3 distractors`); process.exit(1); }
  const options = [q.answer, ...distractors];
  if (new Set(options).size !== options.length) { console.error(`id ${q.id}: duplicate option`, options); process.exit(1); }
  if (distractors.includes(q.answer)) { console.error(`id ${q.id}: a distractor equals the answer`); process.exit(1); }
  q.options = options;
  applied++;
}

const missing = bank.filter((q) => !map[String(q.id)]).map((q) => q.id);
fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
console.log(`Rebalanced ${applied}/${bank.length} in ${bankFile}.` + (missing.length ? ` Not in map: ${missing.join(', ')}` : ' (all covered)'));
