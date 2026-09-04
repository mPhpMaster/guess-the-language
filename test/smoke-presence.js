'use strict';

/* Guards the Discord rich-presence card and the in-app player card — the two
   answers to "which round is that member on, what's their score, what are they
   playing, and can I join?".

   Presence is asserted against a fake window.DISCORD_ACTIVITY that records every
   setActivity() payload: the renderer only ever talks to that public surface, so
   the real SDK is not needed here (and cannot load outside the Vite bundle).
   Run: electron test/smoke-presence.js                                       */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SRC = path.join(__dirname, '..', 'src');
const readBank = () => JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'questions.json'), 'utf8'));
ipcMain.handle('questions:get', async () => readBank());

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
app.setPath('userData', path.join(os.tmpdir(), `gtl-presence-${Date.now()}-${Math.floor(Math.random() * 1e9)}`));

// A room mid-game: 10 questions, on question index 4 (= round 5), two active
// players plus one spectator.
const ROOM_FIXTURE = `
  window.GTL_MULTIPLAYER.state.room = {
    id: 'r1', code: 'AB2C', mode: 'algorithms', status: 'playing', phase: 'question',
    question_index: 4, round_refs: new Array(10).fill({ bank: 'algorithms', id: 1 }),
    settings: { questions: 10, difficulty: 'all', timer: 'auto' }
  };
  window.GTL_MULTIPLAYER.state.players = [
    { id: 'p1', name: 'Zed', score: 500, correct: 4, streak: 2, is_host: true,  spectator: false },
    { id: 'p2', name: 'Ana', score: 300, correct: 3, streak: 0, is_host: false, spectator: false },
    { id: 'p3', name: 'Obs', score: 0,   correct: 0, streak: 0, is_host: false, spectator: true  }
  ];
  window.GTL_MULTIPLAYER.state.playerId = 'p1';
  window.GTL_MULTIPLAYER.state.isAdmin = true;
  state.multiplayer = true; state.spectator = false; state.score = 500;
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900, height: 720, useContentSize: true, show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (code) => win.webContents.executeJavaScript(code, true);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const lastActivity = () => run("window.__ACT[window.__ACT.length - 1] ?? null");

  try {
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(500);

    // --- Presence must be a no-op outside Discord (plain web / Electron). ---
    const noDiscord = await run(`(() => {
      try { pushPresence(); return { threw: false, can: canPublishPresence() }; }
      catch (e) { return { threw: true, msg: String(e) }; }
    })()`);
    check('outside Discord: presence is a no-op', noDiscord.threw === false && noDiscord.can === false,
      noDiscord.msg);

    // --- Install a recording fake Activity + make multiplayer look configured. ---
    await run(`(() => {
      window.__ACT = [];
      window.__INVITED = 0;
      window.__JOINED = [];
      window.DISCORD_ACTIVITY = {
        active: true, embedded: true, ready: Promise.resolve(),
        user: { id: '42', username: 'zed', global_name: 'Zed', avatar: null },
        sessionToken: 'tok', instanceId: 'inst-1', customId: null,
        canSetActivity: true,
        participants: [],
        participant: () => null,
        setActivity: (a) => { window.__ACT.push(a); },
        clearActivity: () => { window.__ACT.push(null); },
        openInviteDialog: () => { window.__INVITED++; return Promise.resolve({}); },
        openExternal: () => null,
        shareLink: () => null
      };
      window.GTL_MULTIPLAYER.configured = () => true;
      window.GTL_MULTIPLAYER.joinRoom = (code) => { window.__JOINED.push(code); return Promise.resolve(); };
      document.documentElement.classList.add('platform-discord');
      var s = JSON.parse(localStorage.getItem('gtl_settings') || '{}');
      s.discordPresence = true;
      localStorage.setItem('gtl_settings', JSON.stringify(s));
      return 'ok';
    })()`);

    // --- Single-player round: mode + round + score, party but no join secret.
    //     Started through the real UI so the round timestamp is stamped the way
    //     startGame() does it, then nudged to question 3 with a score. ---
    await run("document.querySelector('.mode-card[data-mode=cybersecurity]').click(); 'ok'");
    await sleep(700);
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(700);
    const started = await run("document.querySelector('#screen-game').classList.contains('active')");
    check('solo: the game screen opened', started === true);
    await run(`(() => {
      state.index = 2;
      state.score = 350;
      pushPresence();
      return 'ok';
    })()`);
    const solo = await lastActivity();
    check('solo: details names the game mode',
      typeof solo?.details === 'string' && /Cyber/i.test(solo.details), JSON.stringify(solo?.details));
    check('solo: state carries round 3/10', /\b3\/10\b/.test(solo?.state || ''), solo?.state);
    check('solo: state carries the score', /350/.test(solo?.state || ''), solo?.state);
    check('solo: party badge is published', !!solo?.party && solo.party.size?.[0] === 1,
      JSON.stringify(solo?.party));
    check('solo: party max matches the portal capacity', solo?.party?.size?.[1] === 12,
      JSON.stringify(solo?.party?.size));
    check('solo: no join secret (nothing to join)', !solo?.secrets, JSON.stringify(solo?.secrets));
    check('solo: elapsed timer is published', Number.isFinite(solo?.timestamps?.start),
      JSON.stringify(solo?.timestamps));

    // --- Multiplayer round: party size counts active players, join secret set. ---
    await run(`(() => { ${ROOM_FIXTURE} showScreen('game'); pushPresence(); return 'ok'; })()`);
    const mp = await lastActivity();
    check('room: state carries round 5/10', /\b5\/10\b/.test(mp?.state || ''), mp?.state);
    check('room: state carries the score', /500/.test(mp?.state || ''), mp?.state);
    check('room: details names the mode', /Problem|Solving|Algo/i.test(mp?.details || ''), mp?.details);
    check('room: party size counts active players only (2, not 3)',
      mp?.party?.size?.[0] === 2, JSON.stringify(mp?.party?.size));
    // The badge's "of N" must match the Activity's Maximum Participants in the
    // Developer Portal (12, matching the 12-slot player palette), not a made-up cap.
    check('room: party max matches the portal capacity',
      mp?.party?.size?.[1] === 12, JSON.stringify(mp?.party?.size));
    check('room: the card carries the art asset + mode hover text',
      mp?.assets?.large_image === '8-modeselect' && /Problem|Solving/i.test(mp?.assets?.large_text || ''),
      JSON.stringify(mp?.assets));
    check('room: party id is shared per room, not per player',
      mp?.party?.id === 'gtl-room-r1', mp?.party?.id);
    check('room: join secret carries the room code (enables Ask to Join)',
      mp?.secrets?.join === 'room:AB2C', JSON.stringify(mp?.secrets));

    // --- Spectators are labelled as watching, not scoring. ---
    const spectator = await run(`(() => {
      window.GTL_MULTIPLAYER.state.playerId = 'p3';
      state.spectator = true;
      pushPresence();
      var a = window.__ACT[window.__ACT.length - 1];
      window.GTL_MULTIPLAYER.state.playerId = 'p1';
      state.spectator = false;
      return a;
    })()`);
    check('room: a spectator is shown as spectating', /Spectat/i.test(spectator?.state || ''),
      spectator?.state);

    // --- The privacy toggle takes the card down immediately. ---
    const offThenOn = await run(`(() => {
      var row = document.querySelector('#set-presence');
      row.checked = false;
      row.dispatchEvent(new Event('change'));
      var off = window.__ACT[window.__ACT.length - 1];
      var stored = JSON.parse(localStorage.getItem('gtl_settings') || '{}').discordPresence;
      row.checked = true;
      row.dispatchEvent(new Event('change'));
      var on = window.__ACT[window.__ACT.length - 1];
      return { off: off, stored: stored, onIsCard: !!(on && on.state) };
    })()`);
    check('toggle off: presence is cleared', offThenOn.off === null, JSON.stringify(offThenOn.off));
    check('toggle off: choice is persisted', offThenOn.stored === false, String(offThenOn.stored));
    check('toggle on: presence is republished', offThenOn.onIsCard === true);

    // The toggle row is only offered where it can work.
    const rowVisible = await run(`(() => {
      applySettingsToUI();
      const shown = !document.querySelector('#setting-presence-row').classList.contains('hidden');
      window.DISCORD_ACTIVITY.canSetActivity = false;
      applySettingsToUI();
      const hidden = document.querySelector('#setting-presence-row').classList.contains('hidden');
      window.DISCORD_ACTIVITY.canSetActivity = true;
      applySettingsToUI();
      return { shown, hidden };
    })()`);
    check('settings: presence row shown when presence is available', rowVisible.shown === true);
    check('settings: presence row hidden without the scope', rowVisible.hidden === true);

    // --- In-app player card: click a player row. ---
    const card = await run(`(() => {
      ${ROOM_FIXTURE}
      renderMpPlayerList('#lobby-players', window.GTL_MULTIPLAYER.state.players, { compact: false, showKick: false });
      const rows = document.querySelectorAll('#lobby-players .mp-player-row');
      rows[1].click();
      const txt = (sel) => document.querySelector(sel).textContent.trim();
      return {
        rows: rows.length,
        clickable: rows[1].classList.contains('is-clickable') && rows[1].getAttribute('role') === 'button',
        open: document.querySelector('#player-card').open,
        name: txt('#player-card-name'),
        mode: txt('#player-card-mode'),
        round: txt('#player-card-round'),
        score: txt('#player-card-score'),
        correct: txt('#player-card-correct'),
        streak: txt('#player-card-streak'),
        status: txt('#player-card-status'),
        invite: !document.querySelector('#btn-player-card-invite').classList.contains('hidden')
      };
    })()`);
    check('card: player rows are clickable buttons', card.clickable === true);
    check('card: opens on click', card.open === true);
    check('card: shows the clicked player', card.name === 'Ana', card.name);
    check('card: shows the round', card.round === '5 / 10', card.round);
    check('card: shows the score', card.score === '300', card.score);
    check('card: shows correct answers', card.correct === '3', card.correct);
    check('card: shows the streak', card.streak === '0', card.streak);
    check('card: shows the game mode', /Problem|Solving|Algo/i.test(card.mode), card.mode);
    check('card: shows a playing status', /Playing/i.test(card.status), card.status);
    // Inviting is a property of the room, not of a person: the lobby carries the
    // control and this card's footer is Follow + Close. The ability to pull
    // someone in is asserted in smoke-multiplayer, against a rendered lobby.
    check('card: does not duplicate the room invite', card.invite === false);

    // Live score changes refresh an open card in place.
    const live = await run(`(() => {
      window.GTL_MULTIPLAYER.state.players[1].score = 810;
      refreshPlayerCard();
      return { score: document.querySelector('#player-card-score').textContent.trim(),
               open: document.querySelector('#player-card').open };
    })()`);
    check('card: live score update refreshes it in place', live.score === '810' && live.open === true,
      JSON.stringify(live));

    // The invite button opens Discord's native invite sheet.
    await run("document.querySelector('#btn-player-card-invite').click(); 'ok'");
    await sleep(120);
    check('card: invite opens the Discord invite dialog', (await run('window.__INVITED')) === 1);

    // Closing stops the live refresh.
    const closed = await run(`(() => {
      document.querySelector('#btn-player-card-close').click();
      return { open: document.querySelector('#player-card').open };
    })()`);
    check('card: closes on Close', closed.open === false);

    // Spectators have no round to report yet, and read as watching.
    const specCard = await run(`(() => {
      renderMpPlayerList('#lobby-players', window.GTL_MULTIPLAYER.state.players, { compact: false, showKick: false });
      document.querySelectorAll('#lobby-players .mp-player-row')[2].click();
      const out = { round: document.querySelector('#player-card-round').textContent.trim(),
                    status: document.querySelector('#player-card-status').textContent.trim() };
      document.querySelector('#btn-player-card-close').click();
      return out;
    })()`);
    check('card: spectator reads as spectating', /Spectat/i.test(specCard.status), specCard.status);

    // Before the game starts there is no round to show.
    const lobbyCard = await run(`(() => {
      window.GTL_MULTIPLAYER.state.room.status = 'lobby';
      renderMpPlayerList('#lobby-players', window.GTL_MULTIPLAYER.state.players, { compact: false, showKick: false });
      document.querySelectorAll('#lobby-players .mp-player-row')[1].click();
      const out = { round: document.querySelector('#player-card-round').textContent.trim(),
                    status: document.querySelector('#player-card-status').textContent.trim() };
      document.querySelector('#btn-player-card-close').click();
      window.GTL_MULTIPLAYER.state.room.status = 'playing';
      return out;
    })()`);
    check('card: no round shown in the lobby', lobbyCard.round === '—', lobbyCard.round);
    check('card: lobby status shown', /lobby/i.test(lobbyCard.status), lobbyCard.status);

    // The kick button must not also open the card.
    const kick = await run(`(() => {
      window.GTL_MULTIPLAYER.state.room.status = 'lobby';
      window.GTL_MULTIPLAYER.kickPlayer = () => Promise.resolve();
      renderMpPlayerList('#lobby-players', window.GTL_MULTIPLAYER.state.players, { compact: false, showKick: true });
      const btn = document.querySelector('#lobby-players .mp-kick-btn');
      if (btn) btn.click();
      window.GTL_MULTIPLAYER.state.room.status = 'playing';
      return { hadButton: !!btn, open: document.querySelector('#player-card').open };
    })()`);
    check('card: kick button does not open the card',
      kick.hadButton === true && kick.open === false, JSON.stringify(kick));

    // --- A short embed (Discord mobile / small window) must still show the name
    //     and the Invite / Close actions — the card scrolls its stats instead of
    //     pushing the buttons off the bottom edge. ---
    win.setContentSize(400, 520);
    await sleep(300);
    const short = await run(`(() => {
      window.GTL_MULTIPLAYER.state.room.status = 'playing';
      renderMpPlayerList('#lobby-players', window.GTL_MULTIPLAYER.state.players, { compact: false, showKick: false });
      document.querySelectorAll('#lobby-players .mp-player-row')[1].click();
      const dlg = document.querySelector('#player-card');
      const card = dlg.querySelector('.modal-card');
      const stats = dlg.querySelector('.player-card-stats');
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const close = box('#btn-player-card-close');
      const invite = box('#btn-player-card-invite');
      const name = box('#player-card-name');
      const out = {
        vh: window.innerHeight,
        cardBottom: Math.round(c.bottom), cardTop: Math.round(c.top),
        clipped: c.bottom > window.innerHeight + 1 || c.top < -1,
        statsScroll: stats.scrollHeight > stats.clientHeight + 1,
        closeOk: close.top >= 0 && close.bottom <= window.innerHeight + 1,
        inviteOk: invite.top >= 0 && invite.bottom <= window.innerHeight + 1,
        nameOk: name.top >= 0
      };
      document.querySelector('#btn-player-card-close').click();
      return out;
    })()`);
    check('short embed: the card is not clipped', short.clipped === false,
      `card ${short.cardTop}..${short.cardBottom} in ${short.vh}px`);
    check('short embed: the stats scroll instead', short.statsScroll === true);
    check('short embed: Close stays reachable', short.closeOk === true);
    check('short embed: Invite stays reachable', short.inviteOk === true);
    check('short embed: the player name stays visible', short.nameOk === true);
    win.setContentSize(900, 720);
    await sleep(200);

    // --- "Ask to Join": route the joiner into the room the secret names. ---
    const joinSame = await run(`(() => {
      window.__JOINED = [];
      window.dispatchEvent(new CustomEvent('discord-activity-join', { detail: { secret: 'room:AB2C' } }));
      return window.__JOINED.length;
    })()`);
    check('join: already in that room → no re-join', joinSame === 0, String(joinSame));

    await run(`(() => {
      window.__JOINED = [];
      window.dispatchEvent(new CustomEvent('discord-activity-join', { detail: { secret: 'room:ZZ22' } }));
      return 'ok';
    })()`);
    await sleep(400);
    check('join: a different room code is joined', (await run('window.__JOINED[0]')) === 'ZZ22');

    const junk = await run(`(() => {
      window.__JOINED = [];
      window.dispatchEvent(new CustomEvent('discord-activity-join', { detail: { secret: 'not-a-room' } }));
      window.dispatchEvent(new CustomEvent('discord-activity-join', { detail: {} }));
      return window.__JOINED.length;
    })()`);
    check('join: malformed secrets are ignored', junk === 0, String(junk));

    // --- The card a member sees is built from the English strings. ---
    // (The app used to be bilingual and this asserted the Arabic rendering; the
    // language switch is gone, so what matters now is that the card is populated
    // from the dictionary at all and still carries the live round numbers.)
    const englishCard = await run(`(() => {
      ${ROOM_FIXTURE}
      window.GTL_MULTIPLAYER.state.room.status = 'playing';
      showScreen('game');
      pushPresence();
      return window.__ACT[window.__ACT.length - 1];
    })()`);
    check('i18n: presence text is rendered from the dictionary',
      /[A-Za-z]/.test(englishCard?.state || '') && /[A-Za-z]/.test(englishCard?.details || ''),
      JSON.stringify({ details: englishCard?.details, state: englishCard?.state }));
    check('i18n: the round numbers reach the presence card', /\b5\/10\b/.test(englishCard?.state || ''),
      englishCard?.state);

    // --- Back home: the card drops the round and its elapsed timer. ---
    const home = await run(`(() => {
      window.GTL_MULTIPLAYER.leaveRoom = () => Promise.resolve();
      returnHome();
      const a = window.__ACT[window.__ACT.length - 1];
      return { state: a && a.state, details: a && a.details, hasTimer: !!(a && a.timestamps) };
    })()`);
    check('home: presence falls back to a menu state', /menu/i.test(home.state || ''), home.state);
    check('home: the round timer is dropped', home.hasTimer === false);
    check('home: the mode is still advertised', /\S/.test(home.details || ''), home.details);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== DISCORD PRESENCE + PLAYER CARD TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
