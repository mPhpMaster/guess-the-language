'use strict';

/* Verifies the in-menu language switch: default English, toggle to Arabic
   (RTL + translated strings), and toggle back. Run with:
   electron test/smoke-i18n.js                                              */

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Start from a known state.
  await win.loadFile(path.join(SRC, 'index.html'));
  await run("localStorage.removeItem('gtl_lang'); 'ok'");
  await win.webContents.reload();
  await sleep(400);

  try {
    // Mode-select default language, then enter the languages mode menu.
    const msTitle = await run("document.querySelector('.ms-title').textContent");
    check('mode-select title is English', /Choose a game mode/.test(msTitle), msTitle.trim());
    await run("document.querySelector('.mode-card[data-mode=\"languages\"]').click(); 'ok'");
    for (let i = 0; i < 20; i++) {
      const ready = await run("!document.querySelector('#btn-start').disabled");
      if (ready) break;
      await sleep(100);
    }

    const dir0 = await run('document.documentElement.dir');
    check('defaults to LTR (English)', dir0 === 'ltr', dir0);
    const start0 = await run("document.querySelector('#btn-start').textContent");
    check('start button is English', /Start/.test(start0), start0.trim());

    // Switch to Arabic via the menu toggle.
    await run("[...document.querySelectorAll('.lang-switch button')].find(b => b.dataset.setlang==='ar').click(); 'ok'");
    await sleep(120);
    const dir1 = await run('document.documentElement.dir');
    check('switches to RTL (Arabic)', dir1 === 'rtl', dir1);
    const start1 = await run("document.querySelector('#btn-start').textContent");
    check('start button is Arabic', /ابدأ/.test(start1), start1.trim());
    const sub1 = await run("document.querySelector('.menu-sub').textContent");
    check('subtitle translated to Arabic', /خمّن/.test(sub1));
    const persisted = await run("localStorage.getItem('gtl_lang')");
    check('language choice persisted', persisted === 'ar', persisted);

    // Difficulty badge localized inside a game.
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(150);
    const badge = await run("document.querySelector('#code-difficulty').textContent");
    check('difficulty badge localized', /سهل|متوسط|صعب/.test(badge), badge);

    // Switch back to English via the menu toggle (node still in the DOM).
    await run("[...document.querySelectorAll('.lang-switch button')].find(b => b.dataset.setlang==='en').click(); 'ok'");
    await sleep(120);
    const dir2 = await run('document.documentElement.dir');
    check('switches back to LTR', dir2 === 'ltr', dir2);
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
