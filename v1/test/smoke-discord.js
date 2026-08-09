'use strict';

/* Guards the Discord Activity auth gate. The web build requires a Discord
   sign-in before playing, but that gate must NEVER apply inside a Discord
   Activity iframe: the sign-in is a top-level OAuth redirect, which Discord's
   sandbox blocks. When the SDK handshake failed, the gate used to catch the
   Activity too and left the player stuck on an unusable "Sign in to play"
   button. Run: electron test/smoke-discord.js                              */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SRC = path.join(__dirname, '..', 'src');
const readBank = () => JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'questions.json'), 'utf8'));
ipcMain.handle('questions:get', async () => readBank());

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
app.setPath('userData', path.join(os.tmpdir(), `gtl-discord-${Date.now()}-${Math.floor(Math.random() * 1e9)}`));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900, height: 640, useContentSize: true, show: false,
    webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const run = (code) => win.webContents.executeJavaScript(code, true);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    await win.loadFile(path.join(SRC, 'index.html'));
    await sleep(500);
    await run("window.SUPABASE_CONFIG={url:'',anonKey:''}; 'ok'");

    // --- Inside Discord, handshake succeeded: playable, no gate. ---
    const ok = await run(`(() => {
      document.documentElement.classList.add('platform-web','platform-discord');
      window.DISCORD_ACTIVITY = { active:true, embedded:true, ready:Promise.resolve(),
        user:{ id:'42', username:'zed', global_name:'Zed', avatar:null }, sessionToken:'tok' };
      updateStartButtonState();
      return { gate: requiresDiscordLogin(), canPlay: canPlay(),
               hint: !document.querySelector('#web-auth-hint')?.classList.contains('hidden') };
    })()`);
    check('Discord + handshake OK: no login gate', ok.gate === false);
    check('Discord + handshake OK: can play', ok.canPlay === true);
    check('Discord + handshake OK: no web auth hint', ok.hint === false);

    // --- Inside Discord, handshake FAILED: still must not show the web gate. ---
    const failed = await run(`(() => {
      window.DISCORD_ACTIVITY = { active:false, embedded:true, user:null, sessionToken:null, ready:Promise.resolve() };
      updateStartButtonState();
      updateHomeProfile();
      updateDiscordLoginButton();
      const btn = document.querySelector('#btn-start');
      return { gate: requiresDiscordLogin(), btnText: btn.textContent.trim(),
               hint: !document.querySelector('#web-auth-hint')?.classList.contains('hidden'),
               loginBtn: !document.querySelector('#btn-discord-login')?.classList.contains('hidden') };
    })()`);
    check('Discord + handshake FAILED: no login gate', failed.gate === false);
    check('Discord + handshake FAILED: start is not a sign-in prompt',
      !/sign in/i.test(failed.btnText), failed.btnText);
    check('Discord + handshake FAILED: no web auth hint', failed.hint === false);
    check('Discord + handshake FAILED: web login button hidden', failed.loginBtn === false);

    // ...and the player can still reach a game by entering a name.
    await run("var n=document.querySelector('#set-name'); n.value='Zed'; n.dispatchEvent(new Event('input')); 'ok'");
    await run("document.querySelector('.mode-card[data-mode=languages]').click(); 'ok'");
    await sleep(700);
    const recovered = await run("({ canPlay: canPlay(), disabled: document.querySelector('#btn-start').disabled })");
    check('Discord + handshake FAILED: name unlocks play', recovered.canPlay === true && recovered.disabled === false,
      JSON.stringify(recovered));
    await run("document.querySelector('#btn-start').click(); 'ok'");
    await sleep(600);
    const gameActive = await run("document.querySelector('#screen-game').classList.contains('active')");
    check('Discord + handshake FAILED: game starts', gameActive);

    // --- Plain web, signed out: the gate SHOULD still apply. ---
    const web = await run(`(() => {
      document.documentElement.classList.remove('platform-discord');
      localStorage.removeItem('gtl_discord_user');
      window.DISCORD_ACTIVITY = { active:false, embedded:false, user:null, sessionToken:null, ready:Promise.resolve() };
      updateStartButtonState();
      updateHomeProfile();
      return { gate: requiresDiscordLogin(), canPlay: canPlay(),
               hint: !document.querySelector('#web-auth-hint')?.classList.contains('hidden') };
    })()`);
    check('plain web signed out: login gate applies', web.gate === true);
    check('plain web signed out: cannot play', web.canPlay === false);
    check('plain web signed out: auth hint shown', web.hint === true);
  } catch (err) {
    check('no exceptions', false, String(err));
  }

  let passed = 0;
  console.log('\n==== DISCORD ACTIVITY AUTH-GATE TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  app.exit(passed === checks.length ? 0 : 1);
});
