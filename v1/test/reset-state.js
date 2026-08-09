'use strict';

/* One-off: clears persisted localStorage (settings + high score) that the
   capture/smoke scripts may have written, so the app starts from a clean
   slate. Run with:  electron test/reset-state.js                          */

const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await win.webContents.executeJavaScript('localStorage.clear(); "cleared"', true);
  console.log('localStorage cleared');
  app.exit(0);
});
