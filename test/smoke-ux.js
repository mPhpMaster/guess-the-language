'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SRC = path.join(__dirname, '..', 'src');
const BANKS = {
  languages: 'questions.json', cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json', network: 'questions-network.json',
  gamedev: 'questions-gamedev.json', algorithms: 'questions-algo.json'
};
const readBank = (mode) => JSON.parse(fs.readFileSync(path.join(SRC, 'data', BANKS[mode]), 'utf8'));

ipcMain.handle('questions:get', async (_event, mode) => {
  if (mode === 'all') return Object.keys(BANKS).flatMap(readBank).map((q) => q);
  return readBank(BANKS[mode] ? mode : 'languages');
});

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
app.setPath('userData', path.join(os.tmpdir(), `gtl-ux-${Date.now()}`));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 390, height: 844, useContentSize: true, show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (code) => win.webContents.executeJavaScript(code, true);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(500);
  await run("window.SUPABASE_CONFIG={url:'',anonKey:''}; var n=document.querySelector('#set-name'); n.value='UX Tester'; n.dispatchEvent(new Event('input')); 'ok'");
  await run("document.querySelector('.mode-card[data-mode=languages]').click(); 'ok'");
  await sleep(450);

  try {
    await sleep(150);
    const mobile = await run(`(() => {
      const home = document.querySelector('#screen-home');
      const start = document.querySelector('#btn-start').getBoundingClientRect();
      return {
        width: innerWidth,
        overflow: getComputedStyle(home).overflowY,
        startTop: start.top,
        startBottom: start.bottom,
        viewport: innerHeight,
        inactiveVisible: [...document.querySelectorAll('.screen:not(.active)')].some(s => getComputedStyle(s).display !== 'none'),
        columns: getComputedStyle(document.querySelector('#mode-grid')).gridTemplateColumns.split(' ').length
      };
    })()`);
    check('mobile home scrolls', mobile.overflow === 'auto' || mobile.overflow === 'scroll', mobile.overflow);
    check('mobile primary action stays in viewport', mobile.startTop >= 0 && mobile.startBottom <= mobile.viewport, JSON.stringify(mobile));
    check('inactive screens are not rendered', !mobile.inactiveVisible);
    check('mobile mode picker uses two columns', mobile.columns === 2, `columns=${mobile.columns}`);

    const selected = await run("document.querySelector('.mode-card[data-mode=languages]').getAttribute('aria-pressed')");
    check('selected mode exposes aria-pressed', selected === 'true', selected);

    await run("document.querySelector('#btn-settings').click(); 'ok'");
    check('settings opens as a native dialog', await run("document.querySelector('#settings-panel').open"));
    check('dialog receives focus', await run("document.querySelector('#settings-panel').contains(document.activeElement)"));
    check('settings dialog stays fully inside viewport', await run("(() => { const d=document.querySelector('#settings-panel').getBoundingClientRect(); const h=document.querySelector('#settings-title').getBoundingClientRect(); return d.top >= 8 && d.bottom <= innerHeight - 8 && h.top >= d.top && h.bottom <= d.bottom; })()"));
    await run("document.querySelector('#settings-panel').dispatchEvent(new Event('cancel',{cancelable:true})); 'ok'");
    check('Escape/cancel closes settings', !(await run("document.querySelector('#settings-panel').open")));

    const authState = await run(`(() => {
      document.documentElement.classList.add('platform-web');
      localStorage.removeItem('gtl_discord_user');
      updateHomeProfile(); updateStartButtonState();
      const result = { disabled: document.querySelector('#btn-start').disabled, label: document.querySelector('#btn-start').textContent, hint: !document.querySelector('#web-auth-hint').classList.contains('hidden') };
      document.documentElement.classList.remove('platform-web');
      document.querySelector('#set-name').value='UX Tester'; updateHomeProfile(); updateStartButtonState();
      return result;
    })()`);
    check('signed-out web primary action remains enabled', authState.disabled === false, JSON.stringify(authState));
    check('signed-out web explains Discord requirement', /Discord/i.test(authState.label) && authState.hint, JSON.stringify(authState));

    check('unsafe names are detected', await run("isSafePlayerName('f.u.c.k') === false"));
    check('safe names remain visible', await run("safeDisplayName('Ada Lovelace') === 'Ada Lovelace'"));
    check('unsafe historical names are masked', await run("safeDisplayName('f.u.c.k') === t('hiddenPlayer') && safeDisplayName('ᶠᶸᶜᵏᵧₒᵤ!') === t('hiddenPlayer')"));

    await run(`localStorage.setItem('gtl_settings', JSON.stringify({name:'UX Tester',questions:1,sound:false,difficulty:'all',timer:60,feedbackDelay:'manual'})); applySettingsToUI(); window.__GTL_QTIME=60; document.querySelector('#btn-start').click(); 'ok'`);
    await sleep(400);
    await run(`(() => { const cur=state.current; const wrong=[...document.querySelectorAll('#options-grid button')].find(b=>b.dataset.answer!==cur.answer); wrong.click(); state.timeLeft=0; onTimeout(); return 'ok'; })()`);
    await sleep(150);
    check('manual feedback shows Next', await run("!document.querySelector('#btn-next').classList.contains('hidden')"));
    check('manual feedback does not schedule auto advance', await run("state.advanceTimer === null"));
    check('mobile Next button is not covered', await run("(() => { const b=document.querySelector('#btn-next').getBoundingClientRect(); const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return hit === document.querySelector('#btn-next') || document.querySelector('#btn-next').contains(hit); })()"));
    await run("document.querySelector('#btn-next').click(); 'ok'");
    await sleep(350);
    check('results show four statistics', await run("document.querySelectorAll('#result-stats > div').length === 4"));
    check('incorrect-answer review is populated', await run("document.querySelectorAll('#answer-review-list .review-item').length === 1"));
  } catch (error) {
    check('UX smoke test completes without exception', false, String(error));
  }

  let passed = 0;
  console.log('\n==== UX / RESPONSIVE / ACCESSIBILITY TEST ====');
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? `  (${item.detail})` : ''}`);
    if (item.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
