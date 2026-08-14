/* ============================================================
   Application entry — wires the modules together and starts the game.

   Loaded via a dynamic import from renderer.js (a classic script) rather than a
   <script type="module"> tag. That is deliberate: discord-activity.js is already
   a module script that MUST stay ahead of vendor/supabase.js (it calls
   patchUrlMappings at module scope to route Supabase through Discord's proxy),
   and Vite merges every module script in index.html into one chunk placed at the
   first module tag's position. Bundling this file too would therefore hoist the
   whole game ahead of web-shim.js / multiplayer.js and run boot() before
   window.GTL_MULTIPLAYER exists.

   Everything below used to be top-level code in a single 6k-line renderer.js.
   ============================================================ */

import * as constants from './constants.js';
import * as i18n from './i18n.js';
import * as home from './home.js';
import * as appState from './state.js';
import * as dom from './dom.js';
import * as highlight from './highlight.js';
import * as sound from './sound.js';
import * as identity from './identity.js';
import * as settings from './settings.js';
import * as round from './round.js';
import * as game from './game.js';
import * as results from './results.js';
import * as api from './api.js';
import * as leaderboard from './leaderboard.js';
import * as presence from './presence.js';
import * as admin from './admin.js';
import * as profile from './profile.js';
import * as mpUi from './mp-ui.js';
import * as events from './events.js';
import * as bootMod from './boot.js';
import * as uiScale from './ui-scale.js';
import * as util from './util.js';

// Same order the sections appeared in the original single-file renderer.
const NAMESPACES = [
    constants, i18n, home, appState, dom, highlight, sound, identity, settings,
    round, game, results, api, leaderboard, presence, admin, profile, mpUi,
    events, bootMod, uiScale, util
];

/* Re-publish every export as a global. renderer.js used to be a CLASSIC script,
   so each top-level declaration was automatically a global; the Electron smoke
   tests in test/ drive the app by evaluating bare expressions in page context
   (`state.current`, `t('...')`, `onTimeout()`, `safeDisplayName(...)`).
   Republishing keeps that contract intact, so the split stays a pure
   re-organisation. Getters rather than value copies, so `let` bindings the
   modules reassign stay live — exactly how real globals behaved. */
for (const ns of NAMESPACES) {
    for (const key of Object.keys(ns)) {
        try {
            Object.defineProperty(window, key, {
                get: () => ns[key],
                configurable: true
            });
        } catch (_) {
            /* A non-configurable window property would throw. None of our export
               names collide with one, but never take the app down for it. */
        }
    }
}

bootMod.boot();
