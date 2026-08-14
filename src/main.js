'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- Window control IPC (custom title bar) ----
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// ---- Open trusted external links in the default browser ----
ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle('app:version', () => app.getVersion());

// ---- Load a questions database from disk, by mode ----
// One file per bank; the files are never merged on disk.
const QUESTION_FILES = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json',
  network: 'questions-network.json',
  gamedev: 'questions-gamedev.json',
  algorithms: 'questions-algo.json',
  bug: 'questions-bug.json',
  output: 'questions-output.json'
};
const BANK_KEYS = Object.keys(QUESTION_FILES);

// Selectable modes -> the banks they draw from. 'bug' and 'output' are no longer
// modes of their own: Problem Solving now serves all three banks.
const MODE_BANKS = {
  languages: ['languages'],
  cybersecurity: ['cybersecurity'],
  devops: ['devops'],
  network: ['network'],
  gamedev: ['gamedev'],
  algorithms: ['algorithms', 'bug', 'output']
};

async function readBank(fileName) {
  const raw = await fs.promises.readFile(path.join(__dirname, 'data', fileName), 'utf-8');
  return JSON.parse(raw);
}

function tagBank(questions, bank) {
  return questions.map((q) => Object.assign({}, q, { bank }));
}

// Every file keeps its OWN bank tag, never the mode name: each file numbers its
// ids from 1, and the app de-duplicates on the composite key `bank|id`, so
// re-tagging the three algorithms banks alike would collide ids 1..50.
async function loadBanks(banks) {
  const loaded = await Promise.all(
    banks.map(async (bank) => tagBank(await readBank(QUESTION_FILES[bank]), bank))
  );
  return loaded.flat();
}

ipcMain.handle('questions:get', async (_event, mode) => {
  // 'all' walks the bank list directly so each bank is read exactly once.
  if (mode === 'all') return loadBanks(BANK_KEYS);
  return loadBanks(MODE_BANKS[mode] || MODE_BANKS.languages);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
