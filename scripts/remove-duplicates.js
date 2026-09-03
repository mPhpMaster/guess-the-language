#!/usr/bin/env node
'use strict';
/*
 * One-off cleanup (v3.14.0): drop the 26 duplicate questions that accumulated in
 * four banks.
 *
 *   node scripts/remove-duplicates.js [--dry]
 *
 * They went unnoticed because validate-questions.js only ever compared `id`, never
 * question content. Two questions are the same question when
 * `norm(question.en) + '||' + norm(codeSnippet)` matches — prompt alone is not
 * enough (generic prompts like "What is the output?" are reused by design) and
 * snippet alone is not enough either (283 knowledge questions have an empty one).
 * questions.json has no `question` field, so it keys on the snippet alone.
 *
 * In every pair the LOWER id is kept, so the ids below are the later copies.
 * Ids are NOT renumbered: they are explicit fields, not array positions, and
 * nothing requires them to be contiguous (scripts/rebalance/*.json maps are keyed
 * by id, so a removed id just leaves an unused key).
 *
 * validate-questions.js now enforces this permanently — see its duplicate check.
 */
const fs = require('fs');
const path = require('path');

// Verified against the banks before deletion; see the composite key above.
const REMOVE = {
  // Same snippet, same language, only the explanation wording differs.
  'questions.json': [329, 342, 348, 349, 354, 386, 389, 391, 392],
  'questions-cyber.json': [98, 105, 108, 133],
  'questions-devops.json': [53, 59, 62, 113],
  /* 50, 52, 56, 57, 62, 93, 94 are this bank's own duplicate pairs. 51 (SSH port)
     and 83 (HTTPS port) go too: they duplicate cyber#74 and cyber#73 ACROSS banks,
     which matters because "All" mode mixes every bank into one round. Keeping the
     cyber copy rather than the network one is arbitrary and easy to reverse. */
  'questions-network.json': [50, 51, 52, 56, 57, 62, 83, 93, 94]
};

const dry = process.argv.includes('--dry');
let total = 0;

for (const [file, ids] of Object.entries(REMOVE)) {
  const bankPath = path.join(__dirname, '..', 'src', 'data', file);
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const drop = new Set(ids);

  const missing = ids.filter((id) => !bank.some((q) => q.id === id));
  if (missing.length) {
    console.error(`  ✗ ${file}: id(s) ${missing.join(', ')} not found — already removed?`);
    process.exit(1);
  }

  const kept = bank.filter((q) => !drop.has(q.id));
  total += bank.length - kept.length;
  console.log(`  ${dry ? '·' : '✓'} ${file}: ${bank.length} → ${kept.length} (−${ids.length})`);
  if (!dry) fs.writeFileSync(bankPath, JSON.stringify(kept, null, 2) + '\n');
}

console.log(`\n${dry ? 'Would remove' : 'Removed'} ${total} duplicate question(s).`);
