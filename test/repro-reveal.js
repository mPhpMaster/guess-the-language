'use strict';

/* Repro: does a multiplayer reveal ever leave TWO options highlighted as
   correct?  Drives the real handleMultiplayerUpdate through a question/reveal
   sequence and dumps option-button classes.  Run:
     pnpm exec electron test/repro-reveal.js                                   */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const FILES = { languages: 'questions.json', cybersecurity: 'questions-cyber.json', devops: 'questions-devops.json', network: 'questions-network.json' };
const readBank = async (f) => JSON.parse(await fs.promises.readFile(path.join(SRC, 'data', f), 'utf-8'));
ipcMain.handle('questions:get', async (_e, mode) => {
  if (mode === 'all') {
    const banks = await Promise.all(Object.entries(FILES).map(async ([b, f]) => (await readBank(f)).map((q) => Object.assign({}, q, { bank: b }))));
    return banks.flat();
  }
  return (await readBank(FILES[mode] || FILES.languages)).map((q) => Object.assign({}, q, { bank: mode }));
});
ipcMain.handle('app:version', () => '3.0.1');

const MOCK = `
  window.SUPABASE_CONFIG = { url: 'https://t.supabase.co', anonKey: 'k' };
  function __d(t){ if(t==='rooms')return JSON.parse(sessionStorage.getItem('__room')); if(t==='room_players')return JSON.parse(sessionStorage.getItem('__players')); if(t==='room_answers')return JSON.parse(sessionStorage.getItem('__answers')||'[]'); return null; }
  function __b(t){ const b={ select:()=>b, eq:()=>b, order:()=>b, single:async()=>({data:__d(t),error:null}), then:(r,j)=>Promise.resolve({data:__d(t),error:null}).then(r,j) }; return b; }
  window.supabase = { createClient: () => ({
    rpc: async (n) => n==='create_room' ? {data:{roomId:'room1',code:'BXFY',playerId:'p1'},error:null} : {data:null,error:null},
    from: (t)=>__b(t), channel: ()=>{const c={on:()=>c,subscribe:()=>c};return c;}, removeChannel: ()=>{}
  })};
  'ok'
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1000, height: 760, show: false, webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(500);
  await run(MOCK);

  // Pick three languages questions with distinct answers.
  const picks = await run(`window.gameAPI.getQuestions('languages').then(qs => {
    const seen = {}, out = [];
    for (const q of qs) { if (!seen[q.correctLanguage]) { seen[q.correctLanguage] = 1; out.push({ id: q.id, ans: q.correctLanguage }); } if (out.length === 3) break; }
    return out;
  })`);
  console.log('picks:', JSON.stringify(picks));

  await run(`
    sessionStorage.setItem('__players', JSON.stringify([
      { id: 'p1', name: 'xxxxxxx', score: 0, correct: 0, streak: 0, is_host: true,  color: '#2ec5ff', icon: '🦊' },
      { id: 'p2', name: 'asdf',    score: 0, correct: 0, streak: 0, is_host: false, color: '#25d07d', icon: '🐼' }
    ]));
    sessionStorage.setItem('__answers', '[]');
    localStorage.setItem('gtl_settings', JSON.stringify({ questions: 10, sound: false, difficulty: 'all', name: 'xxxxxxx' }));
    'ok'
  `);

  const refs = picks.map((p) => ({ bank: 'languages', id: p.id, optionSeed: 3, duration: 15 }));
  const setRoom = async (index, phase) => {
    await run(`
      (function () {
        sessionStorage.setItem('__room', JSON.stringify({
          id: 'room1', code: 'BXFY', status: 'playing', mode: 'languages', host_player_id: 'p1',
          settings: { questions: 10, difficulty: 'all' }, question_index: ${index}, phase: ${JSON.stringify(phase)},
          round_refs: ${JSON.stringify(refs)},
          question_ends_at: new Date(Date.now() + 9000).toISOString()
        }));
        window.GTL_MULTIPLAYER.refresh();
      })(); 'ok';
    `);
  };
  const dump = async (label) => {
    const info = await run(`JSON.stringify([...document.querySelectorAll('#options-grid button')].map(b => ({ a: b.dataset.answer, c: b.className })))`);
    const arr = JSON.parse(info);
    const greens = arr.filter((b) => /\bcorrect\b/.test(b.c)).map((b) => b.a);
    console.log(label, '-> correct buttons:', JSON.stringify(greens));
  };

  // Enter the room (host flow) on the first question.
  await run('document.querySelector(\'.mode-card[data-mode="languages"]\').click(); "ok"');
  for (let i = 0; i < 25; i++) { if (await run('!document.querySelector("#btn-host").disabled')) break; await sleep(100); }
  await setRoom(0, 'question');
  await run('document.querySelector("#btn-host").click(); "ok"');
  await sleep(500);

  console.log('\n--- NORMAL sequence (every question + reveal processed) ---');
  await setRoom(0, 'question'); await sleep(200);
  await setRoom(0, 'reveal');   await sleep(300); await dump('Q1 reveal');
  await setRoom(1, 'question'); await sleep(200);
  await setRoom(1, 'reveal');   await sleep(300); await dump('Q2 reveal');
  await setRoom(2, 'question'); await sleep(200);
  await setRoom(2, 'reveal');   await sleep(300); await dump('Q3 reveal');

  console.log('\n--- SKIPPED question render (reveal arrives without its question phase) ---');
  await setRoom(0, 'question'); await sleep(200);
  await setRoom(0, 'reveal');   await sleep(300); await dump('Qa reveal');
  // Jump straight to the next reveal, skipping the question phase render:
  await setRoom(1, 'reveal');   await sleep(300); await dump('Qb reveal (no question render)');

  app.exit(0);
});
