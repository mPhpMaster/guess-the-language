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
const BLOCKS = new Set(['p', 'h', 'list', 'code', 'tip', 'warn',
  'hero', 'chat', 'flow', 'cards', 'pills', 'anatomy', 'steps', 'compare']);
const COLORS = new Set(['green', 'blue', 'yellow', 'red', 'purple', 'cyan']);

// The visual blocks: each carries its own structure (see scripts/new/learn-GUIDE-v2.md).
function checkVisual(b, bw) {
  const color = (c, w) => { if (c != null && !COLORS.has(c)) err(w, `unknown color "${c}"`); };
  switch (b.type) {
    case 'hero':
      if (!b.emoji) err(bw, 'hero needs an emoji');
      bi(b, bw);
      return true;
    case 'chat':
      if (!Array.isArray(b.messages) || !b.messages.length) return err(bw, 'chat needs messages'), true;
      b.messages.forEach((m, i) => {
        if (!['client', 'server'].includes(m.from)) err(`${bw} msg ${i + 1}`, `bad from "${m.from}"`);
        if (typeof m.text !== 'string' || !m.text.trim()) err(`${bw} msg ${i + 1}`, 'empty text');
        if (m.note) bi(m.note, `${bw} msg ${i + 1} note`);
      });
      return true;
    case 'flow': {
      const n = Array.isArray(b.nodes) ? b.nodes.length : 0;
      if (n < 2) err(bw, 'flow needs 2+ nodes');
      (b.nodes || []).forEach((nd, i) => { if (!nd.icon) err(`${bw} node ${i + 1}`, 'no icon'); bi(nd.label, `${bw} node ${i + 1}`); });
      if (!Array.isArray(b.links) || b.links.length !== n - 1) err(bw, `links must be nodes-1 (${n - 1})`);
      (b.links || []).forEach((l, i) => { if (l.label) bi(l.label, `${bw} link ${i + 1}`); });
      if (b.returns) bi(b.returns, `${bw} returns`);
      return true;
    }
    case 'cards':
      if (!Array.isArray(b.items) || !b.items.length) return err(bw, 'cards needs items'), true;
      b.items.forEach((it, i) => { color(it.color, `${bw} card ${i + 1}`); bi(it.title, `${bw} card ${i + 1} title`); if (it.text) bi(it.text, `${bw} card ${i + 1} text`); });
      return true;
    case 'pills':
      if (!Array.isArray(b.items) || !b.items.length) return err(bw, 'pills needs items'), true;
      b.items.forEach((it, i) => { color(it.color, `${bw} pill ${i + 1}`); if (!it.text) err(`${bw} pill ${i + 1}`, 'no text'); if (it.label) bi(it.label, `${bw} pill ${i + 1}`); });
      return true;
    case 'anatomy':
      if (!Array.isArray(b.parts) || !b.parts.length) return err(bw, 'anatomy needs parts'), true;
      b.parts.forEach((p, i) => { color(p.color, `${bw} part ${i + 1}`); if (typeof p.text !== 'string') err(`${bw} part ${i + 1}`, 'no text'); if (p.label) bi(p.label, `${bw} part ${i + 1}`); if (ARABIC.test(p.text || '')) err(`${bw} part ${i + 1}`, 'Arabic in code'); });
      return true;
    case 'steps':
      if (!Array.isArray(b.items) || !b.items.length) return err(bw, 'steps needs items'), true;
      b.items.forEach((it, i) => bi(it, `${bw} step ${i + 1}`));
      return true;
    case 'compare':
      ['left', 'right'].forEach((s) => {
        const col = b[s];
        if (!col) return err(bw, `no ${s}`);
        bi(col.title, `${bw} ${s} title`);
        if (!Array.isArray(col.items) || !col.items.length) err(bw, `${s} needs items`);
        (col.items || []).forEach((it, i) => bi(it, `${bw} ${s} ${i + 1}`));
      });
      return true;
    default:
      return false;
  }
}
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
        if (checkVisual(b, bw)) return;
        if (b.type === 'code') {
          if (b.highlight != null) {
            const lines = String(b.code || '').split('\n').length;
            if (!Array.isArray(b.highlight) || b.highlight.some((n) => !Number.isInteger(n) || n < 1 || n > lines)) err(bw, 'highlight lines out of range');
          }
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
