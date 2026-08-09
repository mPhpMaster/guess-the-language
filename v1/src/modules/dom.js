import { pushPresence } from './presence.js';
import { state } from './state.js';

// ---------- DOM helpers ----------
export const $ = (sel) => document.querySelector(sel);
export const screens = {
    home: $('#screen-home'),
    lobby: $('#screen-lobby'),
    game: $('#screen-game'),
    results: $('#screen-results')
};

export function showScreen(name) {
    state.currentScreen = name;
    Object.entries(screens).forEach(([key, screen]) => {
        const active = key === name;
        screen.classList.toggle('active', active);
        screen.hidden = !active;
        screen.inert = !active;
        screen.setAttribute('aria-hidden', String(!active));
    });
    const heading = screens[name].querySelector('.screen-heading, h1, h2');
    if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
    // Every screen change is a presence change (menu / lobby / round / results).
    pushPresence();
}

export function announce(message) {
    const live = $('#app-live-region');
    if (!live || !message) return;
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
}

export const dialogReturnFocus = new WeakMap();
export function openDialog(dialog, initialFocus) {
    if (!dialog || dialog.open) return;
    dialogReturnFocus.set(dialog, document.activeElement);
    dialog.showModal();
    requestAnimationFrame(() => {
        const target = initialFocus || dialog.querySelector('[autofocus], input, select, button');
        target?.focus();
    });
}

export function closeDialog(dialog, returnFocus = true) {
    if (!dialog?.open) return;
    dialog.close();
    if (returnFocus) dialogReturnFocus.get(dialog)?.focus?.();
}
