'use strict';

/**
 * Electron shell for the Svelte build.
 *
 * The renderer is the built SPA in `../dist`, loaded from disk. Question banks
 * are served from `dist/data` by the app's own fetch layer, so unlike the
 * original shell this process no longer needs a `questions:get` IPC handler —
 * one loading path now covers web, Discord and desktop.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 680,
    frame: false,
    backgroundColor: '#0b1a2b',
    show: false,
    title: 'Guess the Language',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void mainWindow.loadFile(path.join(DIST, 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Never let the app navigate itself away from the packaged build; send real
  // links to the user's browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---- Window control IPC (custom title bar) ----
ipcMain.on('window:minimize', () => mainWindow?.minimize());

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window:close', () => mainWindow?.close());

/** Only https is forwarded — never hand an arbitrary scheme to the OS. */
ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) void shell.openExternal(url);
});

ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
