'use strict';

/* Verifies the Cybersecurity mode: mode selection, question loading, the
   text-option UI, answering, and results. Run: electron test/smoke-cyber.js */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const FILES = { languages: 'questions.json', cybersecurity: 'questions-cyber.json' };
ipcMain.handle('questions:get', async (_e, mode) => {
  const f = FILES[mode] || FILES.languages;
  return JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', f), 'utf-8'));
});

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
  await sleep(300);
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'"); // force offline mock

  try {
    const cyberCount = await run("window.gameAPI.getQuestions('cybersecurity').then(a => a.length)");
    check('cyber DB has questions', cyberCount >= 20, `count=${cyberCount}`);

    // Pick the cybersecurity mode.
    await run("document.querySelector('.mode-card[data-mode=\"cybersecurity\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      const ready = await run("!document.querySelector('#btn-start').disabled");
      if (ready) break;
      await sleep(100);
    }
    const homeActive = await run("document.querySelector('#screen-home').classList.contains('active')");
    check('home stays active after picking cyber mode', homeActive);
    const activeMode = await run("(document.querySelector('.mode-card.active')||{}).dataset?.mode");
    check('cyber card is highlighted as active', activeMode === 'cybersecurity', activeMode);

    // Start a cyber game.
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(200);
    const gameActive = await run("document.querySelector('#screen-game').classList.contains('active')");
    check('game screen active', gameActive);
    const isCyberGrid = await run("document.querySelector('#options-grid').classList.contains('cyber')");
    check('options grid uses cyber layout', isCyberGrid);
    const optCount = await run("document.querySelectorAll('#options-grid .opt-btn').length");
    check('renders text options (>=3)', optCount >= 3, `opts=${optCount}`);
    const prompt = await run("(document.querySelector('#code-snippet').textContent || '') + (document.querySelector('#question-text').textContent || '')");
    check('a prompt/question is shown', prompt.trim().length > 0);

    // Answer (mechanics: one correct highlighted, all locked, toast shown).
    await run("document.querySelectorAll('#options-grid .opt-btn')[0].click(); 'ok'");
    await sleep(120);
    const correctMarked = await run("document.querySelectorAll('#options-grid .opt-btn.correct').length");
    check('correct option highlighted', correctMarked === 1, `marked=${correctMarked}`);
    const allDisabled = await run("[...document.querySelectorAll('#options-grid .opt-btn')].every(b => b.disabled)");
    check('options locked after answering', allDisabled);
    const toast = await run("document.querySelector('#answer-toast').classList.contains('show')");
    check('feedback toast shown', toast);

    // Results.
    await run("document.querySelector('#btn-friends').click(); 'ok'");
    await sleep(200);
    const resultsActive = await run("document.querySelector('#screen-results').classList.contains('active')");
    check('results screen active', resultsActive);
    const lbRows = await run("document.querySelectorAll('.lb-row').length");
    check('leaderboard rendered', lbRows >= 1, `rows=${lbRows}`);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== CYBERSECURITY MODE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
