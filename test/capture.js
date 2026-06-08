'use strict';

/* Renders each screen and saves a PNG to screenshots/ so the visuals can be
   reviewed. Run with:  electron test/capture.js                            */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const OUT = path.join(__dirname, '..', 'screenshots');

ipcMain.handle('questions:get', async () => {
  const raw = await fs.promises.readFile(path.join(SRC, 'data', 'questions.json'), 'utf-8');
  return JSON.parse(raw);
});

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    show: true,
    backgroundColor: '#0b1a2b',
    webPreferences: {
      preload: path.join(SRC, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false // keep timers/animations full-speed while unfocused
    }
  });

  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function snap(name) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log('saved', name);
  }

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(600);
  await snap('1-menu.png');

  // Game screen
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('2-game.png');

  // Answered state (shows feedback + highlighted correct answer)
  await run("document.querySelectorAll('.lang-btn')[2].click(); 'ok'");
  await sleep(400);
  await snap('3-answered.png');

  // Results screen — play a clean single-question round and answer it
  // correctly so the final score is non-zero (resets state via reload first).
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:1, sound:false, difficulty:'all'})); 'ok'");
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(500);
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(300);
  const snippet = await run("document.querySelector('#code-snippet').textContent");
  const correct = await run(
    `window.gameAPI.getQuestions().then(qs => { const q = qs.find(x => x.codeSnippet === ${JSON.stringify(snippet)}); return q ? q.correctLanguage : null; })`
  );
  console.log('answering correctly with:', correct);
  await run(
    `(() => { const b = [...document.querySelectorAll('.lang-btn')].find(x => x.dataset.lang === ${JSON.stringify(correct)}); if (b) b.click(); return 'ok'; })()`
  );
  await sleep(3200); // 1700ms auto-advance -> endGame, count-up + bar animation
  await snap('4-results.png');

  // ---- Arabic (RTL) captures ----
  async function playOneAndSnap(name) {
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(300);
    const snip = await run("document.querySelector('#code-snippet').textContent");
    const corr = await run(
      `window.gameAPI.getQuestions().then(qs => { const q = qs.find(x => x.codeSnippet === ${JSON.stringify(snip)}); return q ? q.correctLanguage : null; })`
    );
    await run(
      `(() => { const b = [...document.querySelectorAll('.lang-btn')].find(x => x.dataset.lang === ${JSON.stringify(corr)}); if (b) b.click(); return 'ok'; })()`
    );
    await sleep(3200);
    await snap(name);
  }

  await run("localStorage.setItem('gtl_lang', 'ar'); 'ok'");
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(500);
  await snap('5-menu-ar.png');

  // Arabic game screen (use the default round; just show one question)
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:10, sound:false, difficulty:'all', name:''})); 'ok'");
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(400);
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('6-game-ar.png');

  // Arabic results screen with a real score
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:1, sound:false, difficulty:'all', name:''})); 'ok'");
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(400);
  await playOneAndSnap('7-results-ar.png');

  app.exit(0);
});
