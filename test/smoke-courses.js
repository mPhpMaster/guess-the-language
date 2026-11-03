'use strict';

/* Shape of every Learn course in src/data/courses/. Plain node.
     node test/smoke-courses.js
   The Learn screen trusts this shape (two languages everywhere, an answer
   index that points at an option), so a malformed course is caught here
   rather than as a blank lesson in front of a player. */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'data', 'courses');
const LANGS = ['en', 'ar'];
const BLOCKS = new Set(['p', 'h', 'list', 'code', 'tip', 'warn']);
const CODE_LANGS = new Set(['python', 'http', 'json', 'bash', 'text']);
const DIFFS = new Set(['easy', 'medium', 'hard']);
const ARABIC = /[؀-ۿ]/;

const errors = [];
let checks = 0;
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const bi = (o, where) => {
  checks++;
  if (!o || typeof o !== 'object') return err(where, 'missing bilingual text');
  for (const l of LANGS) if (typeof o[l] !== 'string' || !o[l].trim()) err(where, `empty "${l}"`);
  if (o.ar && !ARABIC.test(o.ar) && !/^[\s\W\d`A-Za-z_.:/{}()[\]"'=<>-]*$/.test(o.ar)) err(where, 'ar has no Arabic');
};

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
if (!files.length) { console.error('no courses found'); process.exit(1); }

for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const cw = f;
  if (c.id + '.json' !== f) err(cw, `id "${c.id}" does not match the file name`);
  bi(c.title, `${cw} title`);
  bi(c.summary, `${cw} summary`);
  if (!Array.isArray(c.levels) || !c.levels.length) { err(cw, 'no levels'); continue; }
  const levelIds = new Set();
  c.levels.forEach((lv, li) => {
    const lw = `${cw} level ${li + 1} (${lv.id})`;
    if (!/^[a-z0-9-]+$/.test(lv.id || '')) err(lw, 'bad id');
    if (levelIds.has(lv.id)) err(lw, 'duplicate level id');
    levelIds.add(lv.id);
    bi(lv.title, `${lw} title`);
    bi(lv.summary, `${lw} summary`);
    if (!Array.isArray(lv.lessons) || lv.lessons.length < 1) err(lw, 'no lessons');
    const lessonIds = new Set();
    (lv.lessons || []).forEach((ls, si) => {
      const sw = `${lw} lesson ${si + 1} (${ls.id})`;
      if (!/^[a-z0-9-]+$/.test(ls.id || '')) err(sw, 'bad id');
      if (lessonIds.has(ls.id)) err(sw, 'duplicate lesson id');
      lessonIds.add(ls.id);
      bi(ls.title, `${sw} title`);
      if (!Array.isArray(ls.blocks) || !ls.blocks.length) err(sw, 'no blocks');
      (ls.blocks || []).forEach((b, bi2) => {
        const bw = `${sw} block ${bi2 + 1}`;
        checks++;
        if (!BLOCKS.has(b.type)) return err(bw, `unknown type "${b.type}"`);
        if (b.type === 'code') {
          if (typeof b.code !== 'string' || !b.code.trim()) err(bw, 'empty code');
          if (b.lang && !CODE_LANGS.has(b.lang)) err(bw, `unknown lang "${b.lang}"`);
          if (ARABIC.test(b.code || '')) err(bw, 'Arabic inside code');
        } else if (b.type === 'list') {
          if (!Array.isArray(b.en) || !Array.isArray(b.ar) || !b.en.length) err(bw, 'list needs en/ar arrays');
          else if (b.en.length !== b.ar.length) err(bw, `list lengths differ (${b.en.length} vs ${b.ar.length})`);
        } else {
          bi(b, bw);
        }
      });
    });
    if (!Array.isArray(lv.quiz) || lv.quiz.length < 5) err(lw, 'quiz needs at least 5 questions');
    (lv.quiz || []).forEach((q, qi) => {
      const qw = `${lw} quiz ${qi + 1}`;
      checks++;
      if (!DIFFS.has(q.difficulty)) err(qw, `bad difficulty "${q.difficulty}"`);
      bi(q.question, `${qw} question`);
      bi(q.explanation, `${qw} explanation`);
      if (!Array.isArray(q.options) || q.options.length !== 4) return err(qw, 'needs 4 options');
      q.options.forEach((o, oi) => bi(o, `${qw} option ${oi + 1}`));
      for (const l of LANGS) {
        if (new Set(q.options.map((o) => o && o[l])).size !== 4) err(qw, `duplicate ${l} options`);
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(qw, `answer ${q.answer} is not 0..3`);
      if (q.codeSnippet != null && typeof q.codeSnippet !== 'string') err(qw, 'codeSnippet must be a string');
    });
  });
  console.log(`${f}: ${c.levels.length} levels, ${c.levels.reduce((n, l) => n + l.lessons.length, 0)} lessons, ${c.levels.reduce((n, l) => n + l.quiz.length, 0)} questions`);
}

errors.forEach((e) => console.log('FAIL  ' + e));
console.log(`==== ${errors.length ? errors.length + ' problem(s)' : 'courses OK'} (${checks} checks) ====`);
process.exit(errors.length ? 1 : 0);
