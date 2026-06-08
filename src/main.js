'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
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
    title: 'Guess the Programming Language',
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

// ---- Load a questions database from disk, by mode ----
const QUESTION_FILES = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json'
};
ipcMain.handle('questions:get', async (_event, mode) => {
  const fileName = QUESTION_FILES[mode] || QUESTION_FILES.languages;
  const file = path.join(__dirname, 'data', fileName);
  const raw = await fs.promises.readFile(file, 'utf-8');
  return JSON.parse(raw);
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
