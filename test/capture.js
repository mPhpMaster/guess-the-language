'use strict';

/* Renders each screen (both modes, both languages) and saves PNGs to
   screenshots/ for review. Run with:  electron test/capture.js            */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const OUT = path.join(__dirname, '..', 'screenshots');
const FILES = {
  languages: 'questions.json', cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json', network: 'questions-network.json'
};
const readBank = async (f) => JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', f), 'utf-8'));

ipcMain.handle('questions:get', async (_e, mode) => {
  if (mode === 'all') return (await Promise.all(Object.values(FILES).map(readBank))).flat();
  return readBank(FILES[mode] || FILES.languages);
});
ipcMain.handle('app:version', () => '2.4.0');

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1280, height: 800, frame: false, show: true, backgroundColor: '#0b1a2b',
    webPreferences: {
      preload: path.join(SRC, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false
    }
  });

  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function snap(name) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log('saved', name);
  }
  async function reload(lang, settings) {
    // Load the file:// page first so localStorage is on the right origin.
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(150);
    if (lang) await run(`localStorage.setItem('gtl_lang', '${lang}'); 'ok'`);
    if (settings) await run(`localStorage.setItem('gtl_settings', '${JSON.stringify(settings)}'); 'ok'`);
    if (lang || settings) { await win.loadFile(path.join(SRC, 'index.html')); await sleep(450); }
    else await sleep(300);
    // Use the offline mock leaderboard for screenshots (don't write to real Supabase).
    await run("window.SUPABASE_CONFIG = { url: '', anonKey: '' }; 'ok'");
  }
  async function pickMode(mode) {
    await run(`document.querySelector('.mode-card[data-mode="${mode}"]').click(); 'ok'`);
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
  }
  async function answerCorrectly(mode, lang) {
    const panel = await run("document.querySelector('#code-snippet').textContent");
    const qtext = await run("document.querySelector('#question-text').textContent");
    let answer;
    if (mode === 'languages') {
      answer = await run(`window.gameAPI.getQuestions('languages').then(qs => { const q = qs.find(x => x.codeSnippet === ${JSON.stringify(panel)}); return q ? q.correctLanguage : null; })`);
    } else {
      const shown = (qtext && qtext.trim()) ? qtext : panel;
      answer = await run(`window.gameAPI.getQuestions('cybersecurity').then(qs => { const q = qs.find(x => x.question['${lang}'] === ${JSON.stringify(shown)}); return q ? q.answer : null; })`);
    }
    await run(`(() => { const b = [...document.querySelectorAll('#options-grid button')].find(x => x.dataset.answer === ${JSON.stringify(answer)}); if (b) b.click(); return 'ok'; })()`);
  }

  // Warm up the window so the first real capture isn't a blank first-paint frame.
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(800);

  try {
  // ---- English: home (mode picker + actions in one page) ----
  await reload('en', { questions: 10, sound: false, difficulty: 'all', name: '' });
  await sleep(250);
  await snap('8-modeselect.png');

  // About dialog
  await run("document.querySelector('#btn-about').click(); 'ok'");
  await sleep(450);
  await snap('12-about.png');
  await run("document.querySelector('#about-close').click(); 'ok'");
  await sleep(150);

  // ---- English: languages mode ----
  await pickMode('languages');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('2-game.png');
  await run("document.querySelectorAll('#options-grid button')[2].click(); 'ok'");
  await sleep(400);
  await snap('3-answered.png');

  // languages results with a real score (single-question round)
  await reload('en', { questions: 1, sound: false, difficulty: 'all', name: '' });
  await pickMode('languages');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(300);
  await answerCorrectly('languages', 'en');
  await sleep(3200);
  await snap('4-results.png');

  // ---- English: cybersecurity mode ----
  await reload('en', { questions: 10, sound: false, difficulty: 'all', name: '' });
  await pickMode('cybersecurity');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('9-cyber-game.png');

  // ---- Arabic: languages mode ----
  await reload('ar', { questions: 10, sound: false, difficulty: 'all', name: '' });
  await snap('11-modeselect-ar.png');
  await pickMode('languages');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('6-game-ar.png');

  // Arabic languages results with a real score
  await reload('ar', { questions: 1, sound: false, difficulty: 'all', name: '' });
  await pickMode('languages');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(300);
  await answerCorrectly('languages', 'ar');
  await sleep(3200);
  await snap('7-results-ar.png');

  // ---- Arabic: cybersecurity game ----
  await reload('ar', { questions: 10, sound: false, difficulty: 'all', name: '' });
  await pickMode('cybersecurity');
  await run("document.querySelector('#btn-start').click(); 'ok'");
  await sleep(500);
  await snap('10-cyber-game-ar.png');
  } catch (err) {
    console.error('capture failed:', err);
  }
  app.exit(0);
});
