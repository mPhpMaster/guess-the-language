'use strict';

/* Verifies the "All" (mixed) mode: the merged bank contains both question
   types, the mode picker offers three modes, and a round plays. Run:
   electron test/smoke-all.js                                               */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const FILES = {
  languages: 'questions.json', cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json', network: 'questions-network.json',
  gamedev: 'questions-gamedev.json', algorithms: 'questions-algo.json'
};
const read = async (f) => JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', f), 'utf-8'));
// Must mirror main.js / web-shim.js: every question carries the bank it came from.
// Without the tag the round builder cannot balance across banks, and ids collide
// between banks — i.e. an untagged stub silently tests something the app never sees.
const tagBank = (questions, bank) => questions.map((q) => Object.assign({}, q, { bank }));
ipcMain.handle('questions:get', async (_e, mode) => {
  if (mode === 'all') {
    const banks = await Promise.all(
      Object.entries(FILES).map(async ([bank, f]) => tagBank(await read(f), bank))
    );
    return banks.flat();
  }
  const bank = FILES[mode] ? mode : 'languages';
  return tagBank(await read(FILES[bank]), bank);
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });


// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

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
  // Set a known round size (don't depend on leftover localStorage from other tests).
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:10, sound:false, difficulty:'all', name:'Tester'})); 'ok'");
  await run("window.__GTL_QTIME=1; window.__GTL_FEEDBACK_MS=100; var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");

  try {
    const cardCount = await run("document.querySelectorAll('.mode-card').length");
    check('mode picker offers all modes', cardCount === 7, `cards=${cardCount}`);

    const merged = await run("window.gameAPI.getQuestions('all').then(a => ({ total: a.length, langs: a.filter(q => q.correctLanguage).length, choice: a.filter(q => Array.isArray(q.options)).length, fill: a.filter(q => !q.correctLanguage && !Array.isArray(q.options) && q.answer != null).length }))");
    check('merged bank is large', merged.total >= 300, `total=${merged.total}`);
    check('merged bank has language questions', merged.langs > 0, `langs=${merged.langs}`);
    check('merged bank has multiple-choice questions', merged.choice > 0, `choice=${merged.choice}`);
    check('merged bank has fill-in questions', merged.fill > 0, `fill=${merged.fill}`);
    check('merged total = langs + choice + fill', merged.total === merged.langs + merged.choice + merged.fill);

    // "All" must actually deal from every bank. Drawing uniformly from the merged
    // pool used to leave ~45% of 10-question rounds with no Problem Solving
    // question at all, because `languages` alone is over half the pool — the
    // reported bug. buildRoundFromPool now deals round-robin across banks.
    const spread = await run(`window.gameAPI.getQuestions('all').then((pool) => {
      const banks = [...new Set(pool.map((q) => q.bank))];
      const missing = {};
      const trials = 200;
      for (let t = 0; t < trials; t++) {
        const round = buildRoundFromPool(pool, { questions: 10, difficulty: 'all' });
        if (round.length !== 10) return { error: 'round length ' + round.length };
        if (new Set(round.map((q) => q.bank + ':' + q.id)).size !== 10) return { error: 'duplicate question' };
        const seen = new Set(round.map((q) => q.bank));
        banks.forEach((b) => { if (!seen.has(b)) missing[b] = (missing[b] || 0) + 1; });
      }
      return { banks: banks.length, missing, worst: Math.max(0, ...Object.values(missing)), trials };
    })`);
    check('every bank is represented in a 10-question All round',
      !spread.error && spread.worst === 0, spread.error || JSON.stringify(spread.missing));
    check('All round draws from all six banks', spread.banks === 6, `banks=${spread.banks}`);

    const algoSeen = await run(`window.gameAPI.getQuestions('all').then((pool) => {
      let withAlgo = 0;
      for (let t = 0; t < 100; t++) {
        if (buildRoundFromPool(pool, { questions: 10, difficulty: 'all' }).some((q) => q.bank === 'algorithms')) withAlgo++;
      }
      return withAlgo;
    })`);
    check('Problem Solving appears in every All round', algoSeen === 100, `${algoSeen}/100`);

    // Play the mixed mode.
    await run("document.querySelector('.mode-card[data-mode=\"all\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    const activeMode = await run("(document.querySelector('.mode-card.selected')||{}).dataset?.mode");
    check('All card is highlighted as active', activeMode === 'all', activeMode);

    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(200);
    check('game screen active', await run("document.querySelector('#screen-game').classList.contains('active')"));
    // First question renders a valid answer UI: options for choice, input for fill.
    const firstOk = await run("(()=>{const s=(state.current||{}).style; if(s==='fill') return !document.querySelector('#fill-form').classList.contains('hidden'); return document.querySelectorAll('#options-grid button').length>=4;})()");
    check('question renders an answer UI', firstOk);

    // Advance through several questions; each renders with a valid style
    // (languages / cyber / fill) and is answerable. The "All" bank now mixes all
    // three, so answer each according to its style.
    const styles = new Set();
    let validEachStep = true;
    for (let i = 0; i < 6; i++) {
      const style = await run("(state.current||{}).style");
      if (style !== 'cyber' && style !== 'languages' && style !== 'fill') validEachStep = false;
      styles.add(style);
      if (style === 'fill') {
        await run("(()=>{const inp=document.querySelector('#fill-input'); inp.value=String(state.current.answer); document.querySelector('#fill-form').dispatchEvent(new Event('submit',{cancelable:true}));})(); 'ok'");
      } else {
        await run("document.querySelectorAll('#options-grid button')[0].click(); 'ok'");
      }
      await sleep(3200); // fast timer (1s) -> resolve -> 1.9s auto-advance
    }
    check('every question in the mixed round had a valid style', validEachStep, [...styles].join(','));
    const advanced = await run("parseInt(document.querySelector('#q-current').textContent, 10)");
    check('mixed round advanced through questions', advanced >= 6, `q=${advanced}`);
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
