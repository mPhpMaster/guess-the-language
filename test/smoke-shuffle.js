'use strict';

/* Regression test: in the multiple-choice modes the correct answer must NOT
   always land on the first button (options are shuffled at render time).
   Run:  electron test/smoke-shuffle.js                                      */

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(300);
  await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'");
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:15, sound:false, difficulty:'all', name:''})); 'ok'");

  try {
    await run("document.querySelector('.mode-card[data-mode=\"cybersecurity\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    const bank = await read('questions-cyber.json');
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(250);

    const positions = [];
    for (let i = 0; i < 12; i++) {
      const panel = await run("document.querySelector('#code-snippet').textContent");
      const qtext = await run("document.querySelector('#question-text').textContent");
      const shown = (qtext && qtext.trim()) ? qtext.trim() : panel.trim();
      const q = bank.find((x) => x.question.en === shown || x.codeSnippet === panel.trim());
      if (q) {
        const idx = await run(`[...document.querySelectorAll('#options-grid button')].findIndex(b => b.dataset.answer === ${JSON.stringify(q.answer)})`);
        if (idx >= 0) positions.push(idx);
      }
      await run("document.querySelectorAll('#options-grid button')[0].click(); 'ok'");
      await sleep(2000);
    }

    check('sampled several questions', positions.length >= 8, `n=${positions.length}`);
    const distinct = new Set(positions);
    check('correct answer is NOT always the first button', !(distinct.size === 1 && distinct.has(0)), `positions=[${positions.join(',')}]`);
    check('correct answer appears in multiple positions', distinct.size >= 2, `distinct=${[...distinct].join(',')}`);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== OPTION SHUFFLE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
