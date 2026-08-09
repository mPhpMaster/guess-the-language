'use strict';

/* Headless smoke test: does the Electron shell actually load the built app?
   Run with:  node_modules/.bin/electron --disable-gpu test/smoke-electron.cjs */

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.on('ready', () => {
    void (async () => {
        const win = new BrowserWindow({
            show: false,
            width: 1280,
            height: 800,
            webPreferences: { contextIsolation: true, sandbox: true },
        });

        const errors = [];
        win.webContents.on('console-message', (_event, level, message) => {
            if (level >= 2) errors.push(message);
        });

        try {
            await win.loadFile(path.join(__dirname, '..', 'dist-web', 'index.html'));
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const report = await win.webContents.executeJavaScript(
                "JSON.stringify({rootLength: document.getElementById('root').innerHTML.length," +
                    ' text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 160),' +
                    " modes: document.querySelectorAll('[aria-pressed]').length})",
            );
            console.log('SMOKE_RESULT', report);
            console.log('SMOKE_CONSOLE_ERRORS', JSON.stringify(errors.slice(0, 5)));
            app.exit(errors.length === 0 ? 0 : 1);
        } catch (err) {
            console.error('SMOKE_FAILED', err);
            app.exit(2);
        }
    })();
});
