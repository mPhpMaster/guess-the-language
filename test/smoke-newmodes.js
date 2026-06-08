'use strict';

/* Verifies the DevOps and Networking modes load and play. Run:
   electron test/smoke-newmodes.js                                          */

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

  for (const mode of ['devops', 'network']) {
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(300);
    await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'"); // force offline mock
    try {
      const count = await run(`window.gameAPI.getQuestions('${mode}').then(a => a.length)`);
      check(`${mode} bank loads`, count >= 20, `count=${count}`);

      await run(`document.querySelector('.mode-card[data-mode="${mode}"]').click(); 'ok'`);
      for (let i = 0; i < 25; i++) {
        if (await run("!document.querySelector('#btn-start').disabled")) break;
        await sleep(100);
      }
      await run("document.querySelector('#btn-start').click(); 'ok'");
      await sleep(200);
      check(`${mode}: game screen active`, await run("document.querySelector('#screen-game').classList.contains('active')"));
      const opts = await run("document.querySelectorAll('#options-grid .opt-btn').length");
      check(`${mode}: renders multiple-choice options`, opts >= 3, `opts=${opts}`);
      const prompt = await run("(document.querySelector('#code-snippet').textContent||'') + (document.querySelector('#question-text').textContent||'')");
      check(`${mode}: a prompt/question is shown`, prompt.trim().length > 0);

      await run("document.querySelectorAll('#options-grid .opt-btn')[0].click(); 'ok'");
      await sleep(120);
      const marked = await run("document.querySelectorAll('#options-grid .opt-btn.correct').length");
      check(`${mode}: correct option highlighted`, marked === 1, `marked=${marked}`);
    } catch (err) {
      check(`${mode}: no exceptions`, false, String(err));
    }
  }

  let passed = 0;
  console.log('\n==== DEVOPS + NETWORK MODES TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
