'use strict';

/* Renders the multiplayer lobby + answer-reveal with a mocked Supabase backend
   and saves PNGs to screenshots/ for visual review.  Run:
     pnpm exec electron test/capture-mp.js                                     */

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
  if (mode === 'all') {
    const banks = await Promise.all(Object.entries(FILES).map(async ([bank, f]) =>
      (await readBank(f)).map((q) => Object.assign({}, q, { bank }))));
    return banks.flat();
  }
  return (await readBank(FILES[mode] || FILES.languages)).map((q) => Object.assign({}, q, { bank: mode }));
});
ipcMain.handle('app:version', () => '3.0.0');

// A unified, table-aware Supabase mock injected into the page. Reads its data
// from sessionStorage so the harness can flip room phase between snapshots.
const MOCK = `
  window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
  function __data(table) {
    if (table === 'rooms') return JSON.parse(sessionStorage.getItem('__room'));
    if (table === 'room_players') return JSON.parse(sessionStorage.getItem('__players'));
    if (table === 'room_answers') return JSON.parse(sessionStorage.getItem('__answers') || '[]');
    return null;
  }
  function __builder(table) {
    const b = {
      select: () => b, eq: () => b, order: () => b,
      single: async () => ({ data: __data(table), error: null }),
      then: (res, rej) => Promise.resolve({ data: __data(table), error: null }).then(res, rej)
    };
    return b;
  }
  window.supabase = {
    createClient: () => ({
      rpc: async (name) => {
        if (name === 'create_room') return { data: { roomId: 'room1', code: 'Z9K3', playerId: 'p1' }, error: null };
        return { data: null, error: null };
      },
      from: (table) => __builder(table),
      channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
      removeChannel: () => {}
    })
  };
  'ok'
`;

const PLAYERS = [
  { id: 'p1', room_id: 'room1', name: 'Mohammad', score: 320, correct: 3, streak: 1, is_host: true,  color: '#2ec5ff', icon: '🦊' },
  { id: 'p2', room_id: 'room1', name: 'Sarah',    score: 410, correct: 4, streak: 2, is_host: false, color: '#19f0c4', icon: '🐼' },
  { id: 'p3', room_id: 'room1', name: 'Omar',     score: 180, correct: 2, streak: 0, is_host: false, color: '#ffd874', icon: '🦉' }
];

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
  const snap = async (name) => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log('saved', name);
  };

  try {
    // ---------- Lobby (host view) ----------
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(500);
    await run(MOCK);
    await run(`
      sessionStorage.setItem('__room', JSON.stringify({
        id: 'room1', code: 'Z9K3', status: 'lobby', mode: 'cybersecurity',
        host_player_id: 'p1', settings: { questions: 15, difficulty: 'medium' },
        question_index: 0, phase: 'question'
      }));
      sessionStorage.setItem('__players', JSON.stringify(${JSON.stringify(PLAYERS.map((p) => Object.assign({}, p, { score: 0, correct: 0, streak: 0 })))}));
      localStorage.setItem('gtl_settings', JSON.stringify({ questions: 15, sound: true, difficulty: 'medium', name: 'Mohammad' }));
      'ok'
    `);
    await run('document.querySelector(\'.mode-card[data-mode="cybersecurity"]\').click(); "ok"');
    for (let i = 0; i < 25; i++) { if (await run('!document.querySelector("#btn-host").disabled')) break; await sleep(100); }
    await run('document.querySelector("#btn-host").click(); "ok"');
    await sleep(900);
    await snap('mp-lobby-host.png');

    // ---------- Answer reveal (everyone's pick on a languages question) ----------
    // Grab a real languages question so resolveQuestion + options line up.
    const q = await run("window.gameAPI.getQuestions('languages').then(qs => ({ id: qs[0].id, ans: qs[0].correctLanguage }))");
    await run(`
      sessionStorage.setItem('__answers', JSON.stringify([
        { player_id: 'p1', answer: ${JSON.stringify(q.ans)} },
        { player_id: 'p2', answer: 'Rust' },
        { player_id: 'p3', answer: ${JSON.stringify(q.ans)} }
      ]));
      sessionStorage.setItem('__players', JSON.stringify(${JSON.stringify(PLAYERS)}));
      sessionStorage.setItem('__room', JSON.stringify({
        id: 'room1', code: 'Z9K3', status: 'playing', mode: 'languages', host_player_id: 'p1',
        settings: { questions: 5, difficulty: 'all' }, question_index: 0, phase: 'question',
        round_refs: [{ bank: 'languages', id: ${JSON.stringify(q.id)}, optionSeed: 7, duration: 15 }],
        question_ends_at: new Date(Date.now() + 15000).toISOString()
      }));
      window.GTL_MULTIPLAYER.refresh();
      'ok'
    `);
    await sleep(500);
    // Lock our own pick, then flip to the reveal phase.
    await run(`(() => { const b = [...document.querySelectorAll('#options-grid button')].find(x => x.dataset.answer === ${JSON.stringify(q.ans)}); if (b) b.click(); return 'ok'; })()`);
    await sleep(300);
    await run(`
      (function () {
        const room = JSON.parse(sessionStorage.getItem('__room'));
        room.phase = 'reveal';
        room.question_ends_at = new Date(Date.now() + 2000).toISOString();
        sessionStorage.setItem('__room', JSON.stringify(room));
        window.GTL_MULTIPLAYER.refresh();
      })(); 'ok';
    `);
    await sleep(700);
    await snap('mp-reveal.png');
    const chips = await run('document.querySelectorAll("#options-grid .mp-answer-chip").length');
    console.log('reveal chips:', chips);

    // ---------- Final scoreboard (Play again + Leave) ----------
    // Stub REST fetch so we can verify the host registers every player's score.
    await run(`
      window.__posts = [];
      window.fetch = async (url, opts = {}) => {
        if ((opts.method || 'GET') === 'POST') window.__posts.push({ url, body: opts.body });
        return { ok: true, status: 204, json: async () => null, text: async () => '' };
      };
      'ok';
    `);
    await run(`
      (function () {
        const room = JSON.parse(sessionStorage.getItem('__room'));
        room.status = 'finished'; room.phase = 'reveal';
        sessionStorage.setItem('__room', JSON.stringify(room));
        window.GTL_MULTIPLAYER.refresh();
      })(); 'ok';
    `);
    await sleep(1200);
    await snap('mp-results.png');
    const replay = await run('document.querySelector("#btn-replay").textContent');
    const leave = await run('document.querySelector("#btn-menu").textContent');
    console.log('results buttons:', replay, '/', leave);
    const posts = JSON.parse(await run('JSON.stringify(window.__posts || [])'));
    const scorePost = posts.find((p) => /\/rest\/v1\/scores$/.test(p.url));
    const body = scorePost ? JSON.parse(scorePost.body) : [];
    console.log('mp score POST rows:', body.length, 'allMultiplayer:', body.every((r) => r.multiplayer === true), 'players:', body.map((r) => r.player).join(','));
  } catch (err) {
    console.error('capture failed:', err);
  }
  app.exit(0);
});
