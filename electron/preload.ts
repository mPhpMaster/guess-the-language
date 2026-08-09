import { contextBridge, ipcRenderer } from 'electron';

/** Minimal, safe API surface exposed to the renderer. */
contextBridge.exposeInMainWorld('appWindow', {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    openExternal: (url: string): void => ipcRenderer.send('open-external', url),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:version') as Promise<string>,
});
