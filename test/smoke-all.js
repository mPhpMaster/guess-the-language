'use strict';

/* Verifies the "All" (mixed) mode: the merged bank contains both question
   types, the mode picker offers three modes, and a round plays. Run:
   electron test/smoke-all.js                                               */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const FILES = { languages: 'questions.json', cybersecurity: 'questions-cyber.json' };
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

  try {
    const cardCount = await run("document.querySelectorAll('.mode-card').length");
    check('mode picker offers three modes', cardCount === 3, `cards=${cardCount}`);

    const merged = await run("window.gameAPI.getQuestions('all').then(a => ({ total: a.length, langs: a.filter(q => q.correctLanguage).length, cyber: a.filter(q => Array.isArray(q.options)).length }))");
    check('merged bank is large', merged.total >= 200, `total=${merged.total}`);
    check('merged bank has language questions', merged.langs > 0, `langs=${merged.langs}`);
    check('merged bank has cyber questions', merged.cyber > 0, `cyber=${merged.cyber}`);
    check('merged total = langs + cyber', merged.total === merged.langs + merged.cyber);

    // Play the mixed mode.
    await run("document.querySelector('.mode-card[data-mode=\"all\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    const t2 = await run("document.querySelector('#menu-title-1').textContent");
    check('menu reflects All mode', /All|الكل/.test(t2), t2);

    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(200);
    check('game screen active', await run("document.querySelector('#screen-game').classList.contains('active')"));
    const optCount = await run("document.querySelectorAll('#options-grid button').length");
    check('question renders options', optCount >= 4, `opts=${optCount}`);

    // Advance through several questions; both option styles should appear.
    const styles = new Set();
    for (let i = 0; i < 8; i++) {
      const isCyber = await run("document.querySelector('#options-grid').classList.contains('cyber')");
      styles.add(isCyber ? 'cyber' : 'languages');
      await run("document.querySelectorAll('#options-grid button')[0].click(); 'ok'");
      await sleep(2000); // wait past the auto-advance
    }
    check('both question styles appeared in a mixed round', styles.size === 2, [...styles].join(','));
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
