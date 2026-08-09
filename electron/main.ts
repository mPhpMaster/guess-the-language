import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

/* ============================================================
   Electron shell. The renderer is the built web app (dist-web),
   so questions and everything else come from the bundle — the
   main process only owns the window and external links.
   ============================================================ */

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
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
            sandbox: true,
        },
    });

    void mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-web', 'index.html'));

    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.on('window:minimize', () => mainWindow?.minimize());

ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

ipcMain.on('window:close', () => mainWindow?.close());

/** Open trusted external links in the default browser. */
ipcMain.on('open-external', (_event, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) void shell.openExternal(url);
});

ipcMain.handle('app:version', () => app.getVersion());

void app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
