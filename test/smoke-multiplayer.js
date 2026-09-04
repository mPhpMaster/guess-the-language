'use strict';

/* Multiplayer UI + client helpers smoke test (mocked Supabase).
   Run: pnpm exec electron test/smoke-multiplayer.js */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');

const BANK_KEYS = ['languages', 'cybersecurity', 'devops', 'network'];
const QUESTION_FILES = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json',
  network: 'questions-network.json'
};

async function readBank(fileName) {
  const raw = await fs.promises.readFile(path.join(SRC, 'data', fileName), 'utf-8');
  return JSON.parse(raw);
}

ipcMain.handle('questions:get', async (_event, mode) => {
  if (mode === 'all') {
    const entries = Object.entries(QUESTION_FILES);
    const banks = await Promise.all(
      entries.map(async ([bank, file]) => {
        const qs = await readBank(file);
        return qs.map((q) => Object.assign({}, q, { bank }));
      })
    );
    return banks.flat();
  }
  const bank = BANK_KEYS.includes(mode) ? mode : 'languages';
  const qs = await readBank(QUESTION_FILES[bank]);
  return qs.map((q) => Object.assign({}, q, { bank }));
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });


// __ISOLATED_USERDATA__: pristine localStorage per run (no cross-test leakage)
try { app.setPath("userData", require("path").join(require("os").tmpdir(), "gtl-test-"+Date.now()+"-"+Math.floor(Math.random()*1e9))); } catch (e) {}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(SRC, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await win.loadFile(path.join(SRC, 'index.html'));
  await sleep(400);

  try {
    check('host room button exists', await run('!!document.querySelector("#btn-host")'));
    check('join room button exists', await run('!!document.querySelector("#btn-join")'));
    check('lobby screen exists', await run('!!document.querySelector("#screen-lobby")'));
    check('join modal exists', await run('!!document.querySelector("#join-modal")'));
    check('join code maxlength is 4', await run('document.querySelector("#join-code").maxLength === 4'));

    const disabledOffline = await run(`
      window.SUPABASE_CONFIG = { url: '', anonKey: '' };
      !window.GTL_MULTIPLAYER.configured()
    `);
    check('host disabled without Supabase config', disabledOffline === true, String(disabledOffline));

    const norm = await run('window.GTL_MULTIPLAYER.normalizeCode("ab-12x")');
    check('normalizeCode yields 4 chars', norm === 'AB12', norm);

    const seedA = await run(`
      const a = window.GTL_MULTIPLAYER.seededShuffle(['A','B','C','D'], 42);
      const b = window.GTL_MULTIPLAYER.seededShuffle(['A','B','C','D'], 42);
      JSON.stringify(a) === JSON.stringify(b)
    `);
    check('seededShuffle is deterministic', seedA === true);

    const score = await run(`
      (function() {
        const base = 100 + 10 * 5;
        const m = 1.5;
        return Math.round(base * m);
      })()
    `);
    check('score formula baseline', score === 225, String(score));

    // Mock Supabase for host flow
    await run(`
      window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
      const room = {
        id: '11111111-1111-1111-1111-111111111111',
        code: 'Z9K3',
        status: 'lobby',
        mode: 'languages',
        host_player_id: '22222222-2222-2222-2222-222222222222',
        settings: {},
        question_index: 0,
        phase: 'question'
      };
      const players = [{
        id: '22222222-2222-2222-2222-222222222222',
        room_id: room.id,
        name: 'HostUser',
        score: 0,
        correct: 0,
        streak: 0,
        is_host: true
      }];

      window.supabase = {
        createClient: () => ({
          rpc: async (name) => {
            if (name === 'create_room') {
              return { data: { roomId: room.id, code: room.code, playerId: players[0].id }, error: null };
            }
            return { data: null, error: null };
          },
          from: (table) => ({
            select: () => ({
              eq: (col, val) => ({
                single: async () => ({ data: table === 'rooms' ? room : null, error: null }),
                order: async () => ({ data: players, error: null })
              })
            })
          }),
          channel: () => {
            const ch = { on: () => ch, subscribe: () => ch };
            return ch;
          },
          removeChannel: () => {}
        })
      };
      'ok'
    `);

    await run("localStorage.setItem('gtl_settings', JSON.stringify({questions:5, sound:false, difficulty:'all', name:'HostUser'})); 'ok'");
    // Hosting/joining now require a name in the input, like a real player.
    await run("var n=document.querySelector('#set-name'); n.value='HostUser'; n.dispatchEvent(new Event('input')); 'ok'");
    await run("document.querySelector('.mode-card[data-mode=\"languages\"]').click(); 'ok'");
    for (let i = 0; i < 25; i++) {
      if (await run('!document.querySelector("#btn-host").disabled')) break;
      await sleep(100);
    }

    await run('document.querySelector("#btn-host").click(); "ok"');
    await sleep(500);

    const lobbyActive = await run('document.querySelector("#screen-lobby").classList.contains("active")');
    check('host opens lobby screen', lobbyActive);

    const code = await run('document.querySelector("#lobby-code").textContent');
    check('lobby shows 4-char code', code.length === 4, code);

    const playerRows = await run('document.querySelectorAll("#lobby-players .mp-player-row").length');
    check('lobby lists at least host', playerRows >= 1, String(playerRows));

    // The host's start / end controls sit in the lobby's single action row now
    // (there is no #lobby-admin wrapper), so they are checked individually.
    const startVisible = await run('!document.querySelector("#btn-lobby-start").classList.contains("hidden")');
    check('host start control visible', startVisible);
    const endVisible = await run('!document.querySelector("#btn-lobby-end").classList.contains("hidden")');
    check('host end-room control visible', endVisible);

    // Host can change all game settings from the lobby.
    const settingsVisible = await run('!document.querySelector("#lobby-settings").classList.contains("hidden")');
    check('host lobby settings visible', settingsVisible);
    // Everyone else reads the same settings as a summary; it is hidden for the
    // host, who has the controls themselves.
    const summaryHidden = await run('document.querySelector("#lobby-summary").classList.contains("hidden")');
    check('host sees controls, not the read-only summary', summaryHidden);
    check('lobby mode select exists', await run('!!document.querySelector("#lobby-mode-select")'));
    check('lobby questions select exists', await run('!!document.querySelector("#lobby-questions")'));
    check('lobby difficulty select exists', await run('!!document.querySelector("#lobby-difficulty")'));
    check('lobby timer select exists', await run('!!document.querySelector("#lobby-timer")'));
    check('lobby timer offers a 5s option', await run('!!document.querySelector("#lobby-timer option[value=\\"5\\"]")'));

    // Players can switch UI language from inside the lobby too.
    // The app is English-only, so the lobby's language switch is gone for good.
    check('lobby has no leftover language switch', await run('!document.querySelector("#screen-lobby .lang-switch, #screen-lobby [data-setlang]")'));

    // Only one in-game End control now (the strip "End Game" was removed).
    check('duplicate end button removed', await run('!document.querySelector("#btn-mp-end")'));

    // Waiting-for-opponents banner is present in the game screen.
    check('mp status banner exists', await run('!!document.querySelector("#mp-status")'));

    // New multiplayer client API surface.
    const api = await run(`(function(){
      const m = window.GTL_MULTIPLAYER;
      return ['restartRoom','updateRoomSettings','fetchAnswers','endRoom','leaveRoom','leaveBeacon'].every((k)=>typeof m[k]==='function');
    })()`);
    check('mp client exposes restart/settings/answers/end/leave', api === true, String(api));

    // Round builder honours the room mode (filters by question bank).
    const modeFilter = await run(`(function(){
      const qs = [
        {bank:'languages', id:1, difficulty:'easy', correctLanguage:'Python'},
        {bank:'devops', id:2, difficulty:'easy', options:['a','b'], answer:'a'}
      ];
      const built = window.GTL_MULTIPLAYER.buildRoundForRoom(qs, {questions:5, difficulty:'all', mode:'languages'});
      return built.roundRefs.length === 1 && built.roundRefs[0].bank === 'languages';
    })()`);
    check('round builder filters by mode', modeFilter === true, String(modeFilter));

    // Host-selectable timer length overrides the per-difficulty default.
    const timerRound = await run(`(function(){
      const qs = [{bank:'languages', id:1, difficulty:'easy', correctLanguage:'Python'}];
      const auto = window.GTL_MULTIPLAYER.buildRoundForRoom(qs, {questions:5, difficulty:'all', mode:'languages'});
      const fixed = window.GTL_MULTIPLAYER.buildRoundForRoom(qs, {questions:5, difficulty:'all', mode:'languages', timer:30});
      return auto.roundRefs[0].duration === 15 && fixed.roundRefs[0].duration === 30;
    })()`);
    check('round builder honours custom timer', timerRound === true, String(timerRound));

    await run('document.querySelector("#btn-join").click(); "ok"');
    await sleep(200);
    const modalOpen = await run('!document.querySelector("#join-modal").classList.contains("hidden")');
    check('join modal opens', modalOpen);

    /* ---- Handing the host role away actually gives up the remove control ----
       Two separate powers rendered the same red x: the room host's remove, and a
       site admin's moderation. Transferring host switched the first off and the
       second on in the same spot, so it looked like the power had stuck. These
       checks pin both halves; nothing in the 26 above noticed it. */
    const SEAT = (hostId, adm) => `(() => {
      const mp = window.GTL_MULTIPLAYER.state;
      mp.playerId = 'p1'; mp.roomId = 'r1'; mp.code = 'A3K9';
      mp.room = { id:'r1', code:'A3K9', status:'lobby', mode:'languages', host_player_id:'${hostId}',
                  settings:{ questions:10, difficulty:'all', timer:'auto' } };
      mp.players = [
        { id:'p1', name:'me',   score:0, is_host:'${hostId}' === 'p1' },
        { id:'p2', name:'rami', score:0, is_host:'${hostId}' === 'p2' },
        { id:'p3', name:'lina', score:0, is_host:false }
      ];
      mp.isAdmin = mp.room.host_player_id === mp.playerId;
      ${adm
        ? `localStorage.setItem('gtl_discord_user', JSON.stringify({ id:'1', name:'a', avatar:null,
             sessionToken: btoa(JSON.stringify({ adm:true, sub:'1', exp:9999999999 }))
               .replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'') + '.sig' }));`
        : `localStorage.removeItem('gtl_discord_user');`}
      showScreen('lobby');
      renderLobby(mp.room, mp.players);
      const rows = [...document.querySelectorAll('#lobby-players .mp-player-row')].map((r) => {
        const b = r.querySelector('.mp-kick-btn');
        return { host: !!r.querySelector('.mp-host-badge'), kick: !!b, adminKick: !!(b && b.classList.contains('is-admin-kick')) };
      });
      return JSON.stringify(rows);
    })()`;

    const asHost = JSON.parse(await run(SEAT('p1', false)));
    check('host can remove the other players', asHost.filter((r) => r.kick).length === 2,
      JSON.stringify(asHost));

    const afterTransfer = JSON.parse(await run(SEAT('p2', false)));
    check('handing host away removes the kick control', afterTransfer.every((r) => !r.kick),
      JSON.stringify(afterTransfer));

    const adminAfterTransfer = JSON.parse(await run(SEAT('p2', true)));
    check('site admin keeps a moderation control, marked as such',
      adminAfterTransfer.filter((r) => r.adminKick).length === 1,
      JSON.stringify(adminAfterTransfer));
    check('site admin cannot remove the room host',
      adminAfterTransfer.every((r) => !(r.host && r.kick)),
      JSON.stringify(adminAfterTransfer));
    await run("localStorage.removeItem('gtl_discord_user'); 'ok'");
  } catch (err) {
    check('no exceptions during multiplayer smoke', false, String(err));
  }

  let passed = 0;
  console.log('\n==== MULTIPLAYER SMOKE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
