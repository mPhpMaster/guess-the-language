'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Minimal, safe API surface exposed to the renderer.
 *
 * Note there is no `gameAPI.getQuestions` here: the Svelte app fetches its
 * question banks from `dist/data` like every other target, so the desktop build
 * shares one loading path instead of a bespoke IPC channel.
 */
contextBridge.exposeInMainWorld('appWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getVersion: () => ipcRenderer.invoke('app:version')
});
