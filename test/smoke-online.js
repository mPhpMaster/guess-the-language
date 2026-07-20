'use strict';

/* Verifies the Supabase ONLINE leaderboard path by configuring credentials
   and stubbing window.fetch inside the renderer, so no live server is needed.
   Run with:  electron test/smoke-online.js                                  */

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


// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Use a single-question round so finishing it triggers the leaderboard submit.
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(200);
  await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:1, sound:false, difficulty:'all', name:'Tester'})); 'ok'");
  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(300);
  // A name is now required to start; make sure the input carries it.
  await run("window.__GTL_QTIME=1; var n=document.querySelector('#set-name'); n.value='Tester'; n.dispatchEvent(new Event('input')); 'ok'");

  // Configure Supabase + stub fetch with canned responses (after the final load).
  await run(`
    window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-anon-key' };
    window.__calls = [];
    window.fetch = async (url, opts = {}) => {
      window.__calls.push({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
      const make = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
      if ((opts.method || 'GET') === 'POST') return make(201, [{ id: 1001, player: 'Me', score: 1234 }]);
      return make(200, [
        { id: 1, player: 'Alice', score: 5000, multiplayer: true },
        { id: 2, player: 'Bob', score: 4000, multiplayer: false },
        { id: 1001, player: 'Me', score: 1234 }
      ]);
    };
    'ok'
  `);

  try {
    // Play one question correctly so a real (non-zero) score is submitted.
    await run("document.querySelector('.mode-card[data-mode=\"languages\"]').click(); 'ok'");
    for (let i = 0; i < 20; i++) {
      if (await run("!document.querySelector('#btn-start').disabled")) break;
      await sleep(100);
    }
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(300);
    const snippet = await run("document.querySelector('#code-snippet').textContent");
    const answer = await run(`window.gameAPI.getQuestions('languages').then(qs => { const q = qs.find(x => x.codeSnippet === ${JSON.stringify(snippet)}); return q ? q.correctLanguage : null; })`);
    await run(`(() => { const b = [...document.querySelectorAll('#options-grid button')].find(x => x.dataset.answer === ${JSON.stringify(answer)}); if (b) b.click(); return 'ok'; })()`);
    await sleep(3400); // fast timer (1s) -> resolve -> 1.9s auto-advance -> endGame -> submit + fetch

    const noteClass = await run("document.querySelector('#lb-note').className");
    check('leaderboard note shows online state', /online/.test(noteClass), noteClass);

    const rows = await run("document.querySelectorAll('.lb-row').length");
    check('renders all returned rows', rows === 3, `rows=${rows}`);

    const youRows = await run("document.querySelectorAll('.lb-row.is-you').length");
    check('exactly one player row flagged', youRows === 1, `you=${youRows}`);

    const youText = await run("(document.querySelector('.lb-row.is-you .lb-bar-fill')||{}).textContent || ''");
    check('player row matched by inserted id', /Me/.test(youText), youText);

    const postCall = await run("JSON.stringify(window.__calls.find(c => c.method === 'POST') || null)");
    const post = JSON.parse(postCall);
    check('POST sent to scores endpoint', post && /\/rest\/v1\/scores$/.test(post.url), post && post.url);
    check('POST carries apikey header', post && post.headers && !!post.headers.apikey);
    check('POST body has player & score', post && /"player"/.test(post.body) && /"score"/.test(post.body));

    const getCall = await run("JSON.stringify(window.__calls.find(c => c.method === 'GET') || null)");
    const get = JSON.parse(getCall);
    check('GET orders by score desc', get && /order=score\.desc/.test(get.url), get && get.url);
    check('GET selects the multiplayer flag', get && /select=[^&]*multiplayer/.test(get.url), get && get.url);

    // Multiplayer-flagged rows get the 👥 sign; single-player rows do not.
    const mpTags = await run("document.querySelectorAll('.lb-mp-tag').length");
    check('multiplayer rows show the multiplayer sign', mpTags === 1, `tags=${mpTags}`);
  } catch (err) {
    check('no exceptions during online run', false, String(err));
  }

  let passed = 0;
  console.log('\n==== SUPABASE ONLINE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
