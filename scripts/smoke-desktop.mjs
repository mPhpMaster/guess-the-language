/**
 * Headless smoke test for the Electron shell: boot the packaged renderer, wait
 * for the home screen to render, and report what it found. Run under Electron:
 *
 *   electron --disable-gpu scripts/smoke-desktop.mjs
 */
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  app.exit(1);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(root, 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true
    }
  });

  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) errors.push(message);
  });

  try {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    // Give the bundle a moment to mount and load its first bank.
    await new Promise((r) => setTimeout(r, 2500));

    const result = await win.webContents.executeJavaScript(`(() => ({
      platform: document.documentElement.className,
      titlebar: !!document.querySelector('.titlebar'),
      controls: document.querySelectorAll('.titlebar-controls .tb-btn').length,
      modeCards: document.querySelectorAll('.mode-card').length,
      startBtn: !!document.querySelector('#btn-start'),
      hasAppWindow: typeof window.appWindow === 'object',
      title: document.querySelector('.home-title')?.textContent?.trim() ?? null
    }))()`);

    console.log('SMOKE RESULT:', JSON.stringify(result, null, 2));
    if (errors.length) console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2));

    if (result.modeCards !== 7) return fail(`expected 7 mode cards, saw ${result.modeCards}`);
    if (!result.startBtn) return fail('start button missing');
    if (!result.titlebar || result.controls !== 3) return fail('title bar / window controls missing');
    if (!result.hasAppWindow) return fail('preload bridge missing');

    console.log('SMOKE OK');
    app.exit(0);
  } catch (err) {
    fail(err?.message ?? String(err));
  }
});
