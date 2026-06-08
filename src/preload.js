'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Minimal, safe API surface exposed to the renderer.
contextBridge.exposeInMainWorld('appWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close')
});

// Game data is read from disk by the main process and handed to the
// renderer, so questions.json stays the single source of truth.
contextBridge.exposeInMainWorld('gameAPI', {
  getQuestions: (mode) => ipcRenderer.invoke('questions:get', mode)
});
