#!/usr/bin/env node
'use strict';
/*
 * Append new questions to a bank, guarding against id collisions.
 *   node scripts/append-questions.js questions-gamedev.json gamedev.json
 *   (bank file in src/data, new-questions file in scripts/new)
 */
const fs = require('fs');
const path = require('path');

const [, , bankFile, newFile] = process.argv;
if (!bankFile || !newFile) { console.error('usage: append-questions.js <bankFile> <newFile>'); process.exit(1); }

const bankPath = path.join(__dirname, '..', 'src', 'data', bankFile);
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const additions = JSON.parse(fs.readFileSync(path.join(__dirname, 'new', newFile), 'utf8'));

const ids = new Set(bank.map((q) => q.id));
for (const q of additions) {
  if (ids.has(q.id)) { console.error(`id ${q.id} already exists in ${bankFile}`); process.exit(1); }
  ids.add(q.id);
}
const merged = bank.concat(additions);
fs.writeFileSync(bankPath, JSON.stringify(merged, null, 2) + '\n');
console.log(`Appended ${additions.length} questions to ${bankFile} (now ${merged.length}).`);
