'use strict';

/* Verifies the fill-in-the-blank "Problem Solving" mode: the typed-answer UI
   replaces the option buttons, a correct answer scores, a wrong one doesn't, and
   grading ignores case/spacing. Run: electron test/smoke-fill.js */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const ALGO = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'questions-algo.json'), 'utf-8'));
ipcMain.handle('questions:get', async () => ALGO);

try { app.setPath('userData', path.join(require('os').tmpdir(), 'gtl-test-' + Date.now() + '-' + Math.floor(Math.random() * 1e9))); } catch (e) {}

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(350);
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'");
  await run("window.__GTL_QTIME=60; window.__GTL_FEEDBACK_MS=1000; var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:10, sound:false, difficulty:'all', name:'Tester'})); 'ok'");

  try {
    await run("document.querySelector('.mode-card[data-mode=\"algorithms\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    check('start enabled after algo bank loads', await run("!document.querySelector('#btn-start').disabled"));

    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(250);
    check('game screen active', await run("document.querySelector('#screen-game').classList.contains('active')"));
    check('fill form is shown', await run("!document.querySelector('#fill-form').classList.contains('hidden')"));
    check('options grid is hidden', await run("document.querySelector('#options-grid').classList.contains('hidden')"));
    check('no option buttons rendered', await run("document.querySelectorAll('#options-grid button').length === 0"));
    check('style is fill', await run("state.current.style") === 'fill');
    check('code panel shows a ____ blank', await run("document.querySelector('#code-snippet').textContent.includes('____')"));

    // Correct answer scores.
    const ans = await run("state.current.answer");
    await run(`(()=>{ const i=document.querySelector('#fill-input'); i.value=${JSON.stringify(String(ans))}; })(); 'ok'`);
    const before = await run("state.score");
    await run("document.querySelector('#fill-form').dispatchEvent(new Event('submit',{cancelable:true})); 'ok'");
    await sleep(200);
    check('correct fill marks input green', await run("document.querySelector('#fill-input').classList.contains('fill-correct')"));
    check('score increased on correct', (await run("state.score")) > before, `score=${await run('state.score')}`);
    check('good feedback toast shown', await run("document.querySelector('#answer-toast').classList.contains('good')"));

    await sleep(2000); // auto-advance
    check('advanced to the next question', await run("state.answered === false"));

    // Wrong answer does not score.
    await run("(()=>{ const i=document.querySelector('#fill-input'); i.value='definitely-wrong-xyz'; })(); 'ok'");
    const before2 = await run("state.score");
    await run("document.querySelector('#fill-submit').click(); 'ok'");
    await sleep(200);
    check('wrong fill marks input red', await run("document.querySelector('#fill-input').classList.contains('fill-wrong')"));
    check('score unchanged on wrong', (await run("state.score")) === before2);
    check('bad feedback toast shown', await run("document.querySelector('#answer-toast').classList.contains('bad')"));

    check('grading ignores case & surrounding spaces',
      await run("isFillCorrect({style:'fill',answer:'range',accept:[]}, '  RANGE ')") === true);
    check('grading rejects empty answer',
      await run("isFillCorrect({style:'fill',answer:'range',accept:[]}, '   ')") === false);
  } catch (err) {
    check('no exceptions during run', false, String(err));
  }

  let passed = 0;
  console.log('\n==== FILL (PROBLEM SOLVING) MODE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
