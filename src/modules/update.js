import { $ } from './dom.js';

// ============================================================
//  "A new version is ready" notice (web / PWA).
//
//  The service worker (public/sw.js) installs a new build in the background and
//  takes over at once (skipWaiting + clients.claim), but the page already
//  running keeps the old JavaScript until it reloads. When control changes
//  hands we say so, instead of leaving the player on the old build until they
//  happen to reload. Never shown mid-round: it waits for the round to end.
// ============================================================
let pending = false;
let waitTimer = null;

export function setupUpdateWatcher() {
    try {
        if (!('serviceWorker' in navigator) || window.top !== window.self) return;
        if (!/^https?:$/.test(location.protocol)) return;
        // Only a CHANGE of controller is an update; the first install isn't.
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hadController) showUpdateToast();
        });
        // Check for a new build every 30 minutes and whenever the tab comes back.
        const check = () => navigator.serviceWorker.getRegistration()
            .then((reg) => reg && reg.update())
            .catch(() => {});
        setInterval(check, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    } catch (_) { /* updates are a convenience, never a failure */ }
}

function inRound() {
    return !!$('#screen-game')?.classList.contains('active');
}

export function showUpdateToast() {
    pending = true;
    if (inRound()) {
        if (!waitTimer) waitTimer = setInterval(() => { if (!inRound()) { clearInterval(waitTimer); waitTimer = null; showUpdateToast(); } }, 3000);
        return;
    }
    $('#update-toast')?.classList.remove('hidden');
}

export function applyUpdateNow() {
    try { location.reload(); } catch (_) {}
}

export function dismissUpdateToast() {
    pending = false;
    $('#update-toast')?.classList.add('hidden');
}

export function updatePending() { return pending; }
