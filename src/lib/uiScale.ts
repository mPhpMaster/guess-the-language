import { createSignal } from 'solid-js';
import { readString, removeKey, writeString } from './storage';

/* ============================================================
   Interface scaling. 4K displays render the Activity very small,
   so the whole UI can be zoomed; wide viewports auto-fit.
   ============================================================ */

const MIN = 0.8;
const MAX = 2.0;
export const UI_SCALE_STEP = 0.1;

/** The content is laid out around this width, then scaled to fill wider windows. */
const AUTOFIT_REFERENCE = 900;

const SCALE_KEY = 'gtl_ui_scale';
const MANUAL_KEY = 'gtl_ui_manual';

const [uiScale, setUiScaleSignal] = createSignal(1);
export { uiScale };

/**
 * A manual override is a DISTINCT flag (not just the presence of `gtl_ui_scale`,
 * which older builds auto-persisted for everyone) so existing users keep autofit.
 */
function hasManualScale(): boolean {
    return readString(MANUAL_KEY) === '1';
}

function storedScale(): number {
    const value = Number.parseFloat(readString(SCALE_KEY) ?? '');
    return Number.isFinite(value) ? Math.min(MAX, Math.max(MIN, value)) : 1;
}

/** Auto scale-to-fill for wide viewports; never shrinks below 1. */
function autoFitScale(): number {
    const width = window.innerWidth || document.documentElement.clientWidth || 1000;
    return Math.min(MAX, Math.max(1, Math.round((width / AUTOFIT_REFERENCE) * 100) / 100));
}

function effectiveScale(): number {
    return hasManualScale() ? storedScale() : autoFitScale();
}

function applyUiScale(scale: number, persist: boolean): void {
    const value = Math.min(MAX, Math.max(MIN, Math.round(scale * 100) / 100));
    document.documentElement.style.setProperty('--ui-scale', String(value));
    document.documentElement.classList.toggle('ui-scaled', Math.abs(value - 1) > 0.001);
    if (persist) writeString(SCALE_KEY, String(value));
    setUiScaleSignal(value);
}

/** Manual +/- from Settings sets a persistent override (turns auto-fit off). */
export function nudgeUiScale(delta: number): void {
    writeString(MANUAL_KEY, '1');
    applyUiScale(effectiveScale() + delta, true);
}

export function resetUiScale(): void {
    removeKey(MANUAL_KEY);
    removeKey(SCALE_KEY);
    applyUiScale(autoFitScale(), false);
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null;

export function installUiScale(): void {
    applyUiScale(effectiveScale(), hasManualScale());
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Re-fit only while the player is on auto (no manual zoom set).
            if (!hasManualScale()) applyUiScale(autoFitScale(), false);
        }, 150);
    });
}
