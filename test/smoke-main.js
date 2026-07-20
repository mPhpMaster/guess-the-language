'use strict';

/* Headless smoke test: launches the real renderer in a hidden Electron
   window, drives the DOM the same way a player would, and reports pass/fail.
   Run with:  electron test/smoke-main.js                                    */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');

// Same handler the real main.js registers.
ipcMain.handle('questions:get', async () => {
  const raw = await fs.promises.readFile(path.join(SRC, 'data', 'questions.json'), 'utf-8');
  return JSON.parse(raw);
});

const checks = [];
function check(name, cond, detail) {
  checks.push({ name, pass: !!cond, detail });
}


// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(SRC, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  win.webContents.on('console-message', (_e, _lvl, msg) => {
    if (/error|fail|exception/i.test(msg)) console.log('   [renderer]', msg);
  });

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(400); // let boot() finish loading questions
  // Force the offline mock leaderboard (don't touch a real Supabase if configured).
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'");
  // A name is required before the player can start; enter one like a real user.
  await run("window.__GTL_QTIME=1; var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");

  try {
    // 0. Home (mode + actions) shown first; pick the languages mode
    const homeActive = await run("document.querySelector('#screen-home').classList.contains('active')");
    check('home screen shown at launch', homeActive);
    await run("document.querySelector('.mode-card[data-mode=\"languages\"]').click(); 'ok'");
    // wait for the mode's questions to load (start button becomes enabled)
    for (let i = 0; i < 20; i++) {
      const ready = await run("!document.querySelector('#btn-start').disabled");
      if (ready) break;
      await sleep(100);
    }

    // 1. Questions database loaded
    const qcount = await run("window.gameAPI.getQuestions('languages').then(a => a.length)");
    check('questions DB has >= 50 entries', qcount >= 50, `count=${qcount}`);

    const startDisabled = await run("document.querySelector('#btn-start').disabled");
    check('start button enabled after load', startDisabled === false, `disabled=${startDisabled}`);

    // 2. Start a game
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(150);
    const gameActive = await run("document.querySelector('#screen-game').classList.contains('active')");
    check('game screen becomes active', gameActive);

    const langCount = await run("document.querySelectorAll('.lang-btn').length");
    check('exactly 6 language buttons', langCount === 6, `count=${langCount}`);

    const codeHtml = await run("document.querySelector('#code-snippet').innerHTML");
    check('code snippet rendered', codeHtml && codeHtml.length > 0);
    check('syntax highlighting applied', /tok-/.test(codeHtml));

    const timerNum = await run("parseInt(document.querySelector('#timer-num').textContent, 10)");
    check('timer shows a positive number', timerNum > 0, `t=${timerNum}`);

    // 3. Answer the question
    await run("document.querySelectorAll('.lang-btn')[0].click(); 'ok'");
    await sleep(1400); // pick = select; resolution happens when the (fast) timer ends
    const correctMarked = await run("document.querySelectorAll('.lang-btn.correct').length");
    check('correct answer highlighted', correctMarked === 1, `marked=${correctMarked}`);
    const allDisabled = await run("Array.from(document.querySelectorAll('.lang-btn')).every(b => b.disabled)");
    check('buttons locked after answering', allDisabled);
    const toastShown = await run("document.querySelector('#answer-toast').classList.contains('show')");
    check('feedback toast shown', toastShown);

    // 4. Results screen + leaderboard
    await run("document.querySelector('#btn-friends').click(); 'ok'");
    await sleep(150);
    const resultsActive = await run("document.querySelector('#screen-results').classList.contains('active')");
    check('results screen becomes active', resultsActive);
    const lbRows = await run("document.querySelectorAll('.lb-row').length");
    check('leaderboard has 5 rows (4 friends + you)', lbRows === 5, `rows=${lbRows}`);
    const youRow = await run("document.querySelectorAll('.lb-row.is-you').length");
    check('player row present in leaderboard', youRow === 1, `you=${youRow}`);
  } catch (err) {
    check('no exceptions during run', false, String(err));
  }

  // Report
  let passed = 0;
  console.log('\n==== SMOKE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);

  app.exit(passed === checks.length ? 0 : 1);
});
