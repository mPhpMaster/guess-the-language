import { $ } from './dom.js';

// Interface scaling — 4K displays render the Activity very small, so let the player
// zoom the whole UI. Uses Chromium's `zoom` (Electron / Discord / Chrome are all
// Chromium), persisted across launches.
export const UI_SCALE_MIN = 0.8, UI_SCALE_MAX = 2.0, UI_SCALE_STEP = 0.1;
// Kept only so the manual zoom stepper has a reference width; nothing auto-scales
// against it any more. See autoFitScale below.
export const AUTOFIT_REF = 1280;
// Manual override is a DISTINCT flag (not just the presence of gtl_ui_scale, which
// older builds auto-persisted for everyone) so existing users still get auto-fit.
export function hasManualScale() { return localStorage.getItem('gtl_ui_manual') === '1'; }
export function getUiScale() {
    const v = parseFloat(localStorage.getItem('gtl_ui_scale'));
    return Number.isFinite(v) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, v)) : 1;
}
// No automatic zoom. This used to return max(1, width / reference), scaling the
// whole UI up on any window wider than the reference — which is why the game
// opened at the wrong size on a large monitor (1920 wide gave 1.5x) and only
// looked right after the player nudged the zoom and set it back, because that
// pins a manual 100%.
//
// It existed because the OLD layout was a fixed-width centred column that left
// the game tiny in a wide Discord panel. The Terminal/IDE layout is fluid — the
// home screen is a grid with its own rail, the round centres a 920px column
// inside full-bleed chrome — so it fills any width on its own and needs no
// transform. Manual zoom still works and is still persisted.
export function autoFitScale() {
    return 1;
}
export function effectiveScale() { return hasManualScale() ? getUiScale() : autoFitScale(); }
// Re-fit when the window resizes (Discord panel resize, window drag) — but only
// while the player is on auto (no manual zoom set).
export let __autofitTimer = null;
export function applyAutoFit() {
    if (hasManualScale()) return;
    applyUiScale(autoFitScale(), false);
}
window.addEventListener('resize', () => {
    if (__autofitTimer) clearTimeout(__autofitTimer);
    __autofitTimer = setTimeout(applyAutoFit, 150);
});
export function applyUiScale(scale, persist = true) {
    const s = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(scale * 100) / 100));
    const root = document.documentElement;
    const app = document.getElementById('app');
    const scaled = Math.abs(s - 1) > 0.001;
    // Responsive scaling (not plain `zoom`): transform-scale #app while dividing its
    // layout width by the same factor, so content REFLOWS into the narrower effective
    // width and always fits horizontally — no clipped buttons. Taller enlarged content
    // scrolls vertically. Applied INLINE (the equivalent CSS rule was being dropped by
    // a cascade quirk against the media-query #app rules); the class drives the body /
    // screen scroll overrides.
    root.style.zoom = '';
    root.style.setProperty('--ui-scale', String(s));
    root.classList.toggle('ui-scaled', scaled);
    if (app) {
        if (scaled) {
            app.style.transformOrigin = '0 0';
            app.style.transform = `scale(${s})`;
            app.style.width = `calc(100% / ${s})`;
            app.style.minHeight = `calc((100vh - var(--tb-h, 0px)) / ${s})`;
            app.style.height = 'auto';
            app.style.overflow = 'visible';
            app.style.display = 'block';
        } else {
            for (const p of ['transformOrigin', 'transform', 'width', 'minHeight', 'height', 'overflow', 'display']) {
                app.style[p] = '';
            }
        }
    }
    if (persist) localStorage.setItem('gtl_ui_scale', String(s));
    const label = $('#ui-scale-value');
    if (label) label.textContent = Math.round(s * 100) + '%';
    return s;
}
// Manual +/- from Settings sets a persistent override (turns auto-fit off).
export function nudgeUiScale(delta) {
    try { localStorage.setItem('gtl_ui_manual', '1'); } catch (e) {}
    applyUiScale(effectiveScale() + delta, true);
}
// Reset back to automatic width-fitting.
export function resetUiScale() {
    try { localStorage.removeItem('gtl_ui_manual'); localStorage.removeItem('gtl_ui_scale'); } catch (e) {}
    applyUiScale(autoFitScale(), false);
}
