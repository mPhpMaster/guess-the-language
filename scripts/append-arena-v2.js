'use strict';

/* Append the authored batches in scripts/new/arena-*-v2.json to their banks.
   Assigns ids continuing from each bank's current maximum, builds the tolerant
   `accept` list for fill questions, and refuses to add a snippet that already
   exists. Run with --dry to see the plan without writing.

     node scripts/append-arena-v2.js [--dry]
*/

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'src', 'data');
const NEW = path.join(__dirname, 'new');
const DRY = process.argv.includes('--dry');

const JOBS = [
  { src: 'arena-bug-v2.json', bank: 'questions-bug.json', kind: 'mc' },
  { src: 'arena-output-v2.json', bank: 'questions-output.json', kind: 'mc' },
  { src: 'arena-fill-v2.json', bank: 'questions-algo.json', kind: 'fill' }
];

// Grading already ignores case and surrounding space; these cover the spacing
// and call-parenthesis choices a player could reasonably type instead.
function acceptVariants(answer) {
  const set = new Set([answer]);
  set.add(answer.replace(/\s+/g, ''));
  if (/^[A-Za-z_$][\w$]*$/.test(answer)) set.add(`${answer}()`);
  return [...set];
}

const bilingual = (o) => o && typeof o.en === 'string' && o.en.trim() && typeof o.ar === 'string' && o.ar.trim();

let failed = 0;
const plan = [];

for (const job of JOBS) {
  const incoming = JSON.parse(fs.readFileSync(path.join(NEW, job.src), 'utf-8'));
  const bankPath = path.join(DATA, job.bank);
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));
  const seen = new Set(bank.map((q) => (q.codeSnippet || '').trim()));
  let nextId = bank.reduce((m, q) => Math.max(m, Number(q.id) || 0), 0) + 1;

  const add = [];
  for (const q of incoming) {
    const where = `${job.src}#${incoming.indexOf(q) + 1}`;
    if (!bilingual(q.question)) { console.error(`  x ${where}: question missing en/ar`); failed++; continue; }
    if (!bilingual(q.explanation)) { console.error(`  x ${where}: explanation missing en/ar`); failed++; continue; }
    if (!['easy', 'medium', 'hard'].includes(q.difficulty)) { console.error(`  x ${where}: bad difficulty`); failed++; continue; }
    if (seen.has((q.codeSnippet || '').trim())) { console.error(`  x ${where}: duplicate snippet, skipped`); failed++; continue; }

    if (job.kind === 'mc') {
      if (!Array.isArray(q.options) || q.options.length !== 4) { console.error(`  x ${where}: needs 4 options`); failed++; continue; }
      if (new Set(q.options).size !== 4) { console.error(`  x ${where}: duplicate options`); failed++; continue; }
      if (!q.options.includes(q.answer)) { console.error(`  x ${where}: answer not among options`); failed++; continue; }
      add.push({ id: nextId++, category: q.category, difficulty: q.difficulty, codeSnippet: q.codeSnippet,
                 question: q.question, options: q.options, answer: q.answer, explanation: q.explanation });
    } else {
      if (!q.codeSnippet.includes('____')) { console.error(`  x ${where}: fill snippet has no ____ blank`); failed++; continue; }
      add.push({ id: nextId++, category: q.category, difficulty: q.difficulty, codeSnippet: q.codeSnippet,
                 question: q.question, answer: q.answer, accept: acceptVariants(q.answer), explanation: q.explanation });
    }
    seen.add((q.codeSnippet || '').trim());
  }

  plan.push({ bank: job.bank, before: bank.length, adding: add.length, after: bank.length + add.length });
  if (!DRY && add.length) fs.writeFileSync(bankPath, JSON.stringify(bank.concat(add), null, 2) + '\n', 'utf-8');
}

console.table(plan);
console.log(DRY ? '(dry run — nothing written)' : 'written.');
if (failed) { console.error(`\n${failed} question(s) rejected.`); process.exit(1); }
