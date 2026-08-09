'use strict';

/* ============================================================
   Guess the Programming Language — renderer bootstrap

   The game logic now lives in ./modules/* (this file used to hold all ~6k lines
   of it). It stays a CLASSIC script on purpose so that index.html's script order
   is unchanged: it must run after web-shim.js and multiplayer.js have defined
   their globals, while discord-activity.js must stay ahead of vendor/supabase.js.
   A <script type="module"> here would be bundled together with
   discord-activity.js and hoisted ahead of both — see modules/app.js.

   The dynamic import resolves against the document URL, which is correct in both
   targets: src/index.html in Electron (file://) and / in the web build.
   ============================================================ */

import('./modules/app.js').catch((err) => {
    console.error('Failed to load game modules:', err);
    try {
        window.GTL_LOG_ERROR?.(err && err.message ? err.message : String(err), {
            source: 'module-load',
            level: 'error',
            stack: err && err.stack
        });
    } catch (_) { /* logging must never mask the original failure */ }
});
