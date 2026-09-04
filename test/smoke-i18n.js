'use strict';

/* The app is English-only: the Arabic dictionary and the EN/ع toggle are gone.
   This test guards what replaced them —
     * the language toggle is really absent from the DOM (no dead control),
     * the document is statically lang="en" / dir="ltr",
     * every [data-i18n] node shows real copy instead of its raw key,
     * a returning player whose profile still holds gtl_lang="ar" gets the
       English LTR app anyway (the migration case — this is the check that
       earns the file its place),
     * and the in-game difficulty badge still resolves to an English label.
   Run with:  electron test/smoke-i18n.js                                    */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
ipcMain.handle('questions:get', async () => {
  const raw = await fs.promises.readFile(path.join(SRC, 'data', 'questions.json'), 'utf-8');
  return JSON.parse(raw);
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

// Reports every [data-i18n] element whose visible text is missing or is still the
// lookup key itself (the classic "translation never applied" symptom).
const READ_I18N_NODES = `(function () {
  var bad = [];
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var text = (el.textContent || '').trim();
    if (!text || text === key) bad.push(key + '="' + text + '"');
  });
  return { total: document.querySelectorAll('[data-i18n]').length, bad: bad };
})()`;

const READ_LANG_STATE = `(function () {
  return {
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    toggles: document.querySelectorAll('.lang-switch, [data-setlang]').length,
    sub: (document.querySelector('.home-sub').textContent || '').trim(),
    start: (document.querySelector('#btn-start').textContent || '').trim()
  };
})()`;

// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Force the offline path (no real Supabase name-dup network call on start) and
  // fill in the name the game requires before it will let a round begin.
  const primeWindow = async () => {
    await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; window.__GTL_QTIME = 1; 'ok'");
    await run("var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");
  };

  try {
    // ---------- 1. A clean profile ----------
    await win.loadFile(path.join(SRC, 'index.html'));
    await run("localStorage.removeItem('gtl_lang'); 'ok'");
    await win.webContents.reload();
    await sleep(400);
    await primeWindow();

    const clean = await run(READ_LANG_STATE);
    check('the language toggle is gone from the DOM', clean.toggles === 0, `nodes=${clean.toggles}`);
    check('document is lang="en"', clean.lang === 'en', clean.lang);
    check('document is dir="ltr"', clean.dir === 'ltr', clean.dir);
    check('home subtitle renders English copy',
      clean.sub.trim().length > 0 && !/[؀-ۿ]/.test(clean.sub), clean.sub);

    const i18nNodes = await run(READ_I18N_NODES);
    check('every [data-i18n] node shows text, not its key',
      i18nNodes.total > 0 && i18nNodes.bad.length === 0,
      `n=${i18nNodes.total}${i18nNodes.bad.length ? ' bad=' + i18nNodes.bad.slice(0, 5).join(', ') : ''}`);

    // ---------- 2. Migration: a profile that still remembers Arabic ----------
    // Players who picked ع before the removal keep gtl_lang='ar' in localStorage.
    // Nothing may read it back into the UI.
    await run("localStorage.setItem('gtl_lang', 'ar'); 'ok'");
    await win.webContents.reload();
    await sleep(400);
    await primeWindow();

    const stale = await run(READ_LANG_STATE);
    check('stale gtl_lang="ar" still renders lang="en"', stale.lang === 'en', stale.lang);
    check('stale gtl_lang="ar" still renders dir="ltr"', stale.dir === 'ltr', stale.dir);
    // The point of this check is that a stale gtl_lang="ar" cannot resurrect the
    // Arabic UI — not that the button says any particular English word. Pinning
    // the literal "Start" made it fail the moment the label became "run ▸", so
    // assert the actual intent: non-empty, and no Arabic script.
    check('stale gtl_lang="ar": start button stays English',
      stale.start.trim().length > 0 && !/[؀-ۿ]/.test(stale.start), stale.start);
    check('stale gtl_lang="ar": subtitle stays English',
      stale.sub.trim().length > 0 && !/[؀-ۿ]/.test(stale.sub), stale.sub);
    check('stale gtl_lang="ar": no toggle reappears', stale.toggles === 0, `nodes=${stale.toggles}`);

    // ---------- 3. In-game strings (still on the stale-'ar' profile) ----------
    await run("document.querySelector('.mode-card[data-mode=\"languages\"]').click(); 'ok'");
    for (let i = 0; i < 20; i++) {
      const ready = await run("!document.querySelector('#btn-start').disabled");
      if (ready) break;
      await sleep(100);
    }
    await run("document.querySelector('#btn-start').click(); 'ok'");
    // startGame is async (it awaits the name check) so the round appears a tick
    // later. A fixed sleep made this flaky — poll for the screen instead, the
    // same way the start button is awaited above.
    for (let i = 0; i < 40; i++) {
      const live = await run("!!document.querySelector('#screen-game.active') && !!document.querySelector('#code-difficulty').dataset.diff");
      if (live) break;
      await sleep(100);
    }
    // `dataset.diff` is only stamped when a question actually renders, so it proves the
    // badge text below came from the running round and not from the static HTML
    // placeholder (which is the lowercase "easy" baked into index.html).
    const badge = await run(`(function () {
      var d = document.querySelector('#code-difficulty');
      return {
        text: (d.textContent || '').trim(),
        diff: d.dataset.diff || '',
        active: !!document.querySelector('#screen-game.active')
      };
    })()`);
    check('difficulty badge renders an English label',
      badge.active && !!badge.diff && /^(Easy|Medium|Hard)$/.test(badge.text),
      `text="${badge.text}" diff="${badge.diff}" active=${badge.active}`);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== I18N TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
