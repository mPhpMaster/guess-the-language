'use strict';

/* Verifies the "All" (mixed) mode: the merged bank contains both question
   types, the mode picker offers three modes, and a round plays. Run:
   electron test/smoke-all.js                                               */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const FILES = {
  languages: 'questions.json', cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json', network: 'questions-network.json'
};
const read = async (f) => JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', f), 'utf-8'));
ipcMain.handle('questions:get', async (_e, mode) => {
  if (mode === 'all') return (await Promise.all(Object.values(FILES).map(read))).flat();
  return read(FILES[mode] || FILES.languages);
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });


// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(300);
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'"); // force offline mock
  // Set a known round size (don't depend on leftover localStorage from other tests).
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:10, sound:false, difficulty:'all', name:'Tester'})); 'ok'");
  await run("window.__GTL_QTIME=1; var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");

  try {
    const cardCount = await run("document.querySelectorAll('.mode-card').length");
    check('mode picker offers all modes', cardCount === 6, `cards=${cardCount}`);

    const merged = await run("window.gameAPI.getQuestions('all').then(a => ({ total: a.length, langs: a.filter(q => q.correctLanguage).length, choice: a.filter(q => Array.isArray(q.options)).length }))");
    check('merged bank is large', merged.total >= 300, `total=${merged.total}`);
    check('merged bank has language questions', merged.langs > 0, `langs=${merged.langs}`);
    check('merged bank has multiple-choice questions', merged.choice > 0, `choice=${merged.choice}`);
    check('merged total = langs + choice', merged.total === merged.langs + merged.choice);

    // Play the mixed mode.
    await run("document.querySelector('.mode-card[data-mode=\"all\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    const activeMode = await run("(document.querySelector('.mode-card.selected')||{}).dataset?.mode");
    check('All card is highlighted as active', activeMode === 'all', activeMode);

    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(200);
    check('game screen active', await run("document.querySelector('#screen-game').classList.contains('active')"));
    const optCount = await run("document.querySelectorAll('#options-grid button').length");
    check('question renders options', optCount >= 4, `opts=${optCount}`);

    // Advance through several questions; each renders with a valid option style.
    // (That a single round mixes types is guaranteed by the merged-bank checks
    // above plus per-type rendering in smoke-main / smoke-cyber — asserting both
    // appear in one *random* round would be flaky.)
    const styles = new Set();
    let validEachStep = true;
    for (let i = 0; i < 6; i++) {
      const cls = await run("document.querySelector('#options-grid').className");
      const isCyber = /cyber/.test(cls), isLang = /languages/.test(cls);
      if (!isCyber && !isLang) validEachStep = false;
      styles.add(isCyber ? 'cyber' : 'languages');
      await run("document.querySelectorAll('#options-grid button')[0].click(); 'ok'");
      await sleep(3200); // fast timer (1s) -> resolve -> 1.9s auto-advance
    }
    check('every question in the mixed round had a valid style', validEachStep, [...styles].join(','));
    const advanced = await run("parseInt(document.querySelector('#q-current').textContent, 10)");
    check('mixed round advanced through questions', advanced >= 6, `q=${advanced}`);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== ALL (MIXED) MODE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
