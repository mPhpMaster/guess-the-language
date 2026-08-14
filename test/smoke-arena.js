'use strict';

/* Problem Solving (mode `algorithms`) is now a MERGED category: the fill-in-the-blank
   `algorithms` bank plus the two multiple-choice banks that used to be standalone modes
   — `bug` (Fix The Bug) and `output` (Guess the Output). This test proves the merge:
   the three banks load as one 234-question pool, the two retired mode cards are gone,
   and a single round mixes BOTH answer styles (option buttons AND the typed fill input).
   Run:  electron test/smoke-arena.js                                            */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');

// Mirrors src/main.js: one file per bank, and every file keeps its OWN bank tag —
// each file numbers its ids from 1 and the app de-duplicates on the composite key
// `bank|id`, so re-tagging the three Problem Solving banks alike would collide.
const QUESTION_FILES = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json',
  network: 'questions-network.json',
  gamedev: 'questions-gamedev.json',
  algorithms: 'questions-algo.json',
  bug: 'questions-bug.json',
  output: 'questions-output.json'
};
const BANK_KEYS = Object.keys(QUESTION_FILES);

// Selectable modes -> the banks they draw from. 'bug'/'output' are not modes anymore.
const MODE_BANKS = {
  languages: ['languages'],
  cybersecurity: ['cybersecurity'],
  devops: ['devops'],
  network: ['network'],
  gamedev: ['gamedev'],
  algorithms: ['algorithms', 'bug', 'output']
};

const readBank = async (file) =>
  JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', file), 'utf-8'));
const loadBanks = async (banks) =>
  (await Promise.all(banks.map(async (bank) =>
    (await readBank(QUESTION_FILES[bank])).map((q) => Object.assign({}, q, { bank })))
  )).flat();

ipcMain.handle('questions:get', async (_e, mode) => {
  if (mode === 'all') return loadBanks(BANK_KEYS);
  return loadBanks(MODE_BANKS[mode] || MODE_BANKS.languages);
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

const ARABIC = /[؀-ۿ]/;

// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath('userData', path.join(require('os').tmpdir(), 'gtl-test-' + Date.now() + '-' + Math.floor(Math.random() * 1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Snapshot of the current question's answer UI.
  const READ_QUESTION = `(function () {
    var grid = document.querySelector('#options-grid');
    var form = document.querySelector('#fill-form');
    return {
      isFill: !!form && !form.classList.contains('hidden'),
      gridHidden: !!grid && grid.classList.contains('hidden'),
      opts: document.querySelectorAll('#options-grid .opt-btn').length,
      hasInput: !!document.querySelector('#fill-input'),
      question: (document.querySelector('#question-text').textContent || '').trim(),
      snippet: document.querySelector('#code-snippet').textContent || ''
    };
  })()`;

  // Snapshot after the question has been graded/revealed.
  const READ_RESOLUTION = `(function () {
    var input = document.querySelector('#fill-input');
    var panel = document.querySelector('#feedback-panel');
    return {
      marked: document.querySelectorAll('#options-grid .opt-btn.correct').length,
      fillGraded: !!input && (input.classList.contains('fill-correct') || input.classList.contains('fill-wrong')),
      feedbackShown: !!panel && !panel.classList.contains('hidden')
    };
  })()`;

  async function openHome(lang) {
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(400);
    await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'"); // force offline mock
    // The display language is baked in when a question is RENDERED, so it has to be
    // chosen before the round starts — switching mid-question does not re-render.
    // setLang() lives in an ES module (not on window), so drive the real EN/ع toggle
    // first; re-applying the language repaints the home screen.
    await run(`var b = document.querySelector('#screen-home [data-setlang="${lang === 'ar' ? 'ar' : 'en'}"]');`
      + " if (b) b.click(); 'ok'");
    await sleep(200);
    // A 20-question round samples the merged pool widely; __GTL_QTIME=1 keeps it quick.
    await run("window.__GTL_QTIME=1;"
      + " var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input'));"
      + " var q=document.querySelector('#set-questions'); if (q) q.value='20'; 'ok'");
  }

  async function startProblemSolving() {
    await run("document.querySelector('.mode-card[data-mode=\"algorithms\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(300);
    return run("document.querySelector('#screen-game').classList.contains('active')");
  }

  /* Play the merged mode and record ONE example of each answer style. The round is
     sampled (order is not fixed), so this walks question by question instead of
     assuming positions, and replays fresh rounds if a round happened to show only
     one style. `seen.mc` / `seen.fill` stay null when a style never appeared — the
     caller turns that into a loud FAIL. */
  async function collectBothStyles(lang) {
    const seen = { started: false, mc: null, fill: null, mcCount: 0, fillCount: 0, rounds: 0, htmlLang: '' };
    for (let attempt = 0; attempt < 3 && !(seen.mc && seen.fill); attempt++) {
      await openHome(lang);
      seen.htmlLang = await run("document.documentElement.lang");
      const active = await startProblemSolving();
      seen.rounds++;
      if (active) seen.started = true; else continue;
      for (let step = 0; step < 24; step++) {
        if (!(await run("document.querySelector('#screen-game').classList.contains('active')"))) break;
        const q = await run(READ_QUESTION);
        if (q.isFill) {
          await run("var i=document.querySelector('#fill-input'); i.value='probe';"
            + " document.querySelector('#fill-submit').click(); 'ok'");
          await sleep(250); // single-player grades a typed answer immediately
        } else {
          await run("var b=document.querySelectorAll('#options-grid .opt-btn')[0]; if (b) b.click(); 'ok'");
          await sleep(1300); // a pick only selects; the (fast) timer resolves it
        }
        const r = await run(READ_RESOLUTION);
        if (q.isFill) { seen.fillCount++; if (!seen.fill) seen.fill = Object.assign({}, q, r); }
        else { seen.mcCount++; if (!seen.mc) seen.mc = Object.assign({}, q, r); }
        if (seen.mc && seen.fill) break;
        await run("var n=document.querySelector('#btn-next'); if (n && !n.classList.contains('hidden')) n.click(); 'ok'");
        await sleep(200);
      }
    }
    return seen;
  }

  // ---------- 1. The merged bank ----------
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(400);
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'");
  try {
    const bank = await run(`window.gameAPI.getQuestions('algorithms').then(function (qs) {
      var by = {};
      qs.forEach(function (q) { by[q.bank] = (by[q.bank] || 0) + 1; });
      var keys = {};
      qs.forEach(function (q) { keys[(q.bank || '') + '|' + q.id] = 1; });
      var fill = qs.filter(function (q) { return q.bank === 'algorithms' && q.id > 84; });
      var mc = qs.filter(function (q) { return q.bank === 'bug' || q.bank === 'output'; });
      var ar = /[\\u0600-\\u06FF]/;
      return {
        total: qs.length,
        byBank: by,
        uniqueKeys: Object.keys(keys).length,
        fill: {
          n: fill.length,
          noOptions: fill.every(function (q) { return !q.options; }),
          hasAccept: fill.every(function (q) { return Array.isArray(q.accept) && q.accept.length > 0; }),
          blanked: fill.filter(function (q) { return (q.codeSnippet || '').indexOf('____') >= 0; }).length,
          arabic: fill.every(function (q) { return q.question && ar.test(q.question.ar || ''); })
        },
        mc: {
          n: mc.length,
          four: mc.filter(function (q) { return Array.isArray(q.options) && q.options.length === 4; }).length,
          answerInOptions: mc.every(function (q) { return q.options.indexOf(q.answer) >= 0; }),
          bilingual: mc.every(function (q) {
            return q.question && q.question.en && ar.test(q.question.ar || '')
              && q.explanation && q.explanation.en && q.explanation.ar;
          })
        }
      };
    })`);
    check('merged Problem Solving bank loads', bank.total === 234, `total=${bank.total}`);
    check('merged bank keeps all three bank tags',
      bank.byBank.algorithms === 134 && bank.byBank.bug === 50 && bank.byBank.output === 50,
      `algorithms=${bank.byBank.algorithms} bug=${bank.byBank.bug} output=${bank.byBank.output}`);
    check('merged bank has no colliding bank|id keys', bank.uniqueKeys === bank.total,
      `unique=${bank.uniqueKeys}/${bank.total}`);

    check('imported fill questions present', bank.fill.n === 50, `n=${bank.fill.n}`);
    check('imported fill questions have no options', bank.fill.noOptions);
    check('imported fill questions have accept lists', bank.fill.hasAccept);
    check('imported fill questions carry a ____ blank', bank.fill.blanked === 50, `blanked=${bank.fill.blanked}`);
    check('imported fill questions carry Arabic text', bank.fill.arabic);

    check('imported bug/output questions present', bank.mc.n === 100, `n=${bank.mc.n}`);
    check('imported bug/output questions have exactly 4 options', bank.mc.four === 100, `four=${bank.mc.four}`);
    check('imported bug/output answers are among their options', bank.mc.answerInOptions);
    check('imported bug/output questions are bilingual', bank.mc.bilingual);
  } catch (err) {
    check('merged bank: no exceptions', false, String(err));
  }

  // ---------- 2. The mode cards ----------
  check('Problem Solving mode card exists',
    await run("!!document.querySelector('.mode-card[data-mode=\"algorithms\"]')"));
  check('the Fix The Bug mode card is gone',
    await run("!document.querySelector('.mode-card[data-mode=\"bug\"]')"));
  check('the Guess the Output mode card is gone',
    await run("!document.querySelector('.mode-card[data-mode=\"output\"]')"));

  // ---------- 3. Playing the merged mode (English) ----------
  let en = { started: false, mc: null, fill: null, mcCount: 0, fillCount: 0, rounds: 0 };
  try {
    en = await collectBothStyles('en');
  } catch (err) {
    check('merged mode round: no exceptions', false, String(err));
  }
  const seenDetail = `mc=${en.mcCount} fill=${en.fillCount} rounds=${en.rounds}`;
  const mc = en.mc || {};
  const fill = en.fill || {};

  check('merged mode: game screen active', en.started);
  check('merged round: a multiple-choice question appeared', !!en.mc, seenDetail);
  check('merged round: a fill-in-the-blank question appeared', !!en.fill, seenDetail);
  check('merged round mixes BOTH answer styles', !!(en.mc && en.fill), seenDetail);

  check('MC question renders four .opt-btn options', mc.opts === 4, `opts=${mc.opts}`);
  check('MC question keeps the fill input hidden', en.mc ? mc.isFill === false : false);
  check('MC question shows a prompt', ((mc.snippet || '') + (mc.question || '')).trim().length > 0);
  check('MC question highlights the correct option once resolved', mc.marked === 1, `marked=${mc.marked}`);

  check('fill question shows the typed-answer input', en.fill ? (fill.isFill === true && fill.hasInput === true) : false);
  check('fill question hides the options grid', en.fill ? (fill.gridHidden === true && fill.opts === 0) : false,
    `gridHidden=${fill.gridHidden} opts=${fill.opts}`);
  check('fill question renders the ____ blank', (fill.snippet || '').indexOf('____') >= 0);
  check('fill answer is graded once submitted', fill.fillGraded === true);

  // The MC style can only come from the folded-in banks, and the fill style only from
  // the algorithms bank — matching the on-screen text back to the files proves it.
  try {
    const mcText = new Set((await loadBanks(['bug', 'output'])).map((q) => (q.question.en || '').trim()));
    const fillText = new Set((await loadBanks(['algorithms'])).map((q) => ((q.question && q.question.en) || '').trim()));
    check('the MC question came from the bug/output banks', mcText.has((mc.question || '').trim()),
      `q="${(mc.question || '').slice(0, 34)}"`);
    check('the fill question came from the algorithms bank', fillText.has((fill.question || '').trim()),
      `q="${(fill.question || '').slice(0, 34)}"`);
  } catch (err) {
    check('bank provenance: no exceptions', false, String(err));
  }

  // ---------- 4. Both styles render in Arabic ----------
  let ar = { mc: null, fill: null, mcCount: 0, fillCount: 0, rounds: 0, htmlLang: '' };
  try {
    ar = await collectBothStyles('ar');
  } catch (err) {
    check('Arabic round: no exceptions', false, String(err));
  }
  const arMc = (ar.mc || {}).question || '';
  const arFill = (ar.fill || {}).question || '';
  check('Arabic: the language actually switched', ar.htmlLang === 'ar', `html.lang=${ar.htmlLang}`);
  check('Arabic: the MC question renders Arabic text', ARABIC.test(arMc), `ar="${arMc.slice(0, 26)}"`);
  check('Arabic: the fill question renders Arabic text', ARABIC.test(arFill), `ar="${arFill.slice(0, 26)}"`);

  let passed = 0;
  console.log('\n==== PROBLEM SOLVING MERGED BANK TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
