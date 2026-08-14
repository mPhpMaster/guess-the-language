'use strict';

/* Renders scripts/discord-icon.html to a 1024x1024 PNG for Discord's "App Icon"
   (Developer Portal -> General Information -> App Icon), which is the square
   avatar shown for the app everywhere in the client.

   Run:  npx electron scripts/make-discord-icon.js
   Out:  screenshots/discord-icon.png                                        */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const W = 1024;
const H = 1024; // Discord requires 1:1 at 1024x1024.
const SRC = path.join(__dirname, 'discord-icon.html');
const OUT = path.join(__dirname, '..', 'screenshots', 'discord-icon.png');

// Force a 1x device scale factor: on a HiDPI Windows display capturePage()
// otherwise returns a 1.25x/1.5x bitmap and the upload is the wrong size.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W,
    height: H,
    useContentSize: true, // width/height describe the page, not the frame
    frame: false,
    show: false,
    backgroundColor: '#07111e',
    webPreferences: { offscreen: false, backgroundThrottling: false }
  });

  try {
    await win.loadFile(SRC);
    win.webContents.setZoomFactor(1);
    // Give the web font and the emoji glyphs a moment to load, otherwise the
    // first paint falls back to a system face and the layout shifts.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
    await new Promise((r) => setTimeout(r, 600));

    let image = await win.webContents.capturePage();
    const size = image.getSize();
    if (size.width !== W || size.height !== H) {
      console.log(`captured ${size.width}x${size.height} — resizing to ${W}x${H}`);
      image = image.resize({ width: W, height: H, quality: 'best' });
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, image.toPNG());
    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    const final = image.getSize();
    console.log(`Wrote ${OUT} — ${final.width}x${final.height}, ${kb} kB`);
    app.exit(final.width === W && final.height === H ? 0 : 1);
  } catch (err) {
    console.error('Icon render failed:', err);
    app.exit(1);
  }
});
