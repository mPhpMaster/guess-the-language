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
const QUESTION_FILES = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json',
  network: 'questions-network.json'
};
const BANK_KEYS = Object.keys(QUESTION_FILES);

async function readBank(fileName) {
  const raw = await fs.promises.readFile(path.join(__dirname, 'data', fileName), 'utf-8');
  return JSON.parse(raw);
}

function tagBank(questions, bank) {
  return questions.map((q) => Object.assign({}, q, { bank }));
}

ipcMain.handle('questions:get', async (_event, mode) => {
  if (mode === 'all') {
    const entries = Object.entries(QUESTION_FILES);
    const banks = await Promise.all(
      entries.map(async ([bank, file]) => tagBank(await readBank(file), bank))
    );
    return banks.flat();
  }
  const bank = BANK_KEYS.includes(mode) ? mode : 'languages';
  const qs = await readBank(QUESTION_FILES[bank] || QUESTION_FILES.languages);
  return tagBank(qs, bank);
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
