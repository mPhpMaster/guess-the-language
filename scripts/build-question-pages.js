#!/usr/bin/env node
'use strict';
/*
 * Static page per question: dist-web/q/<bank>/<id>.html, plus a per-topic index,
 * sitemap.xml and robots.txt. Run by `build:web` after the app is built.
 *
 * Why: the answer review links "full explanation" here, and a page per question
 * is shareable ("look at this one") and indexable — people searching for "what
 * does git rebase --onto do" can land on a question and then on the game.
 *
 * Plain HTML with inline CSS and no script: nothing to load, nothing to break.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');
const OUT = path.join(ROOT, 'dist-web');
const ORIGIN = process.env.GTL_SITE_ORIGIN || 'https://guess-the-language-chi.vercel.app';

// bank -> [file, mode, topic title]
const BANKS = {
  languages: ['questions.json', 'languages', 'Programming Languages'],
  cybersecurity: ['questions-cyber.json', 'cybersecurity', 'Cybersecurity'],
  devops: ['questions-devops.json', 'devops', 'DevOps'],
  network: ['questions-network.json', 'network', 'Networking'],
  gamedev: ['questions-gamedev.json', 'gamedev', 'Game Dev'],
  algorithms: ['questions-algo.json', 'algorithms', 'Problem Solving — fill the blank'],
  bug: ['questions-bug.json', 'algorithms', 'Problem Solving — fix the bug'],
  output: ['questions-output.json', 'algorithms', 'Problem Solving — predict the output'],
  sql: ['questions-sql.json', 'sql', 'SQL & Databases'],
  regex: ['questions-regex.json', 'regex', 'Regex'],
  git: ['questions-git.json', 'git', 'Git'],
  linux: ['questions-linux.json', 'linux', 'Linux CLI'],
  ai: ['questions-ai.json', 'ai', 'AI & ML']
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline `code` spans, as the game renders them.
const rich = (s) => esc(s).split('`').map((part, i, arr) =>
  (i % 2 === 1 && i < arr.length - 1) ? `<code>${part}</code>` : part).join('');

const plain = (s) => String(s || '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

const CSS = `
:root{color-scheme:dark;--bg:#0b0d0c;--panel:#111514;--line:#ffffff14;--text:#f2f6f3;--muted:#c3ccc7;--dim:#8a9490;--neon:#6ee7a0;--bad:#e88a9a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 "IBM Plex Sans","Segoe UI",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}
a{color:var(--neon)}header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:28px;font:13px "IBM Plex Mono",ui-monospace,monospace;color:var(--dim)}
header a{text-decoration:none}.crumb{color:var(--dim)}
h1{font-size:22px;line-height:1.35;margin:0 0 16px}
pre{background:#0d100f;border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow:auto;font:14px/1.55 "JetBrains Mono",ui-monospace,monospace;color:#dfe5e0}
code{font-family:"JetBrains Mono",ui-monospace,monospace;background:#ffffff0d;border-radius:4px;padding:1px 5px;font-size:.92em}
ol{list-style:none;padding:0;margin:20px 0;display:grid;gap:8px}
li{border:1px solid var(--line);border-radius:8px;padding:10px 14px;background:var(--panel);color:var(--muted)}
li.ok{border-color:#6ee7a088;color:var(--text)}li.ok::before{content:"✓ ";color:var(--neon);font-weight:700}
.meta{font:12px "IBM Plex Mono",ui-monospace,monospace;color:var(--dim);margin-bottom:10px}
.why{border-left:3px solid var(--neon);padding:4px 0 4px 14px;margin:24px 0;color:var(--muted)}
.cta{display:inline-block;margin-top:12px;background:var(--neon);color:#08120c;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px}
nav.pager{display:flex;justify-content:space-between;margin-top:36px;font:13px "IBM Plex Mono",ui-monospace,monospace}
ul.index{list-style:none;padding:0;display:grid;gap:6px}ul.index a{text-decoration:none;color:var(--muted)}ul.index a:hover{color:var(--text)}
`;

function page({ title, description, canonical, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
</head>
<body><main>
<header><a href="/">$ ./guess_the_language</a><span class="crumb">${body.crumb || ''}</span></header>
${body.html}
</main></body>
</html>
`;
}

function questionText(q) {
  if (q.correctLanguage) return 'Which programming language is this?';
  if (q.question && q.question.en) return q.question.en;
  return 'Fill in the blank (____)';
}

const sitemap = [`${ORIGIN}/`];
let pages = 0;

for (const [bank, [file, mode, topic]] of Object.entries(BANKS)) {
  const qs = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  const dir = path.join(OUT, 'q', bank);
  fs.mkdirSync(dir, { recursive: true });
  const playUrl = `/?mode=${encodeURIComponent(mode)}`;
  const sorted = qs.slice().sort((a, b) => a.id - b.id);

  sorted.forEach((q, i) => {
    const prompt = questionText(q);
    const answer = q.correctLanguage || q.answer;
    const canonical = `${ORIGIN}/q/${bank}/${q.id}.html`;
    const options = q.correctLanguage ? [] : (q.options || []);
    const optHtml = options.length
      ? `<ol>${options.map((o) => `<li class="${o === answer ? 'ok' : ''}">${rich(o)}</li>`).join('')}</ol>`
      : `<p><strong>Answer:</strong> ${rich(answer)}${(q.accept && q.accept.length) ? ` <span class="meta">(also accepted: ${q.accept.map(esc).join(', ')})</span>` : ''}</p>`;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const html = `
<div class="meta">${esc(topic)} · ${esc(q.difficulty || '')} · #${q.id}</div>
<h1>${rich(prompt)}</h1>
${q.codeSnippet ? `<pre>${esc(q.codeSnippet)}</pre>` : ''}
${optHtml}
<div class="why">${rich(q.explanation && q.explanation.en)}</div>
<a class="cta" href="${playUrl}">Play ${esc(topic.split(' — ')[0])} ▸</a>
<nav class="pager">${prev ? `<a href="${prev.id}.html">◂ #${prev.id}</a>` : '<span></span>'}<a href="index.html">all ${esc(topic)} questions</a>${next ? `<a href="${next.id}.html">#${next.id} ▸</a>` : '<span></span>'}</nav>`;
    const snippetLine = plain(q.codeSnippet).slice(0, 60);
    // A short generic prompt ("What does this print?") needs the snippet to be
    // told apart from its neighbours; a long one stands on its own.
    const p = plain(prompt);
    const head = p.length > 70 ? `${p.slice(0, 67)}…` : p;
    const title = `${head}${p.length < 40 && snippetLine && !q.correctLanguage ? ` — ${snippetLine.slice(0, 40)}` : ''} | ${topic} quiz`;
    const description = `${plain(prompt)} Answer: ${plain(answer)}. ${plain(q.explanation && q.explanation.en)}`.slice(0, 300);
    fs.writeFileSync(path.join(dir, `${q.id}.html`), page({
      title, description, canonical,
      body: { crumb: `<a href="index.html">${esc(topic)}</a>`, html }
    }));
    sitemap.push(canonical);
    pages += 1;
  });

  const list = sorted.map((q) => `<li><a href="${q.id}.html">#${q.id} · ${rich(questionText(q))}${q.correctLanguage ? ` <span class="meta">${esc(plain(q.codeSnippet).slice(0, 50))}</span>` : (q.codeSnippet ? ` <span class="meta">${esc(plain(q.codeSnippet).slice(0, 50))}</span>` : '')}</a></li>`).join('\n');
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    title: `${topic} questions | Guess the Language`,
    description: `All ${sorted.length} ${topic} questions in Guess the Language, with answers and explanations.`,
    canonical: `${ORIGIN}/q/${bank}/index.html`,
    body: { crumb: esc(topic), html: `<h1>${esc(topic)} — ${sorted.length} questions</h1><a class="cta" href="${playUrl}">Play ▸</a><ul class="index">${list}</ul>` }
  }));
  sitemap.push(`${ORIGIN}/q/${bank}/index.html`);
}

fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
console.log(`question pages: ${pages} pages, sitemap with ${sitemap.length} urls`);
