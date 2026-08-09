/**
 * Interface scaling.
 *
 * 4K displays and the very wide Discord Activity panel leave the game tiny and
 * centred, so the whole UI scales up. This is *responsive* scaling rather than
 * plain `zoom`: `#app` is transform-scaled while its layout width is divided by
 * the same factor, so content reflows into the narrower effective width and
 * always fits horizontally — no clipped buttons.
 */

export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 2.0;
export const UI_SCALE_STEP = 0.1;

/** Content is laid out around this width, then scaled up to fill wider windows. */
const AUTOFIT_REF = 900;

const SCALE_KEY = 'gtl_ui_scale';
/**
 * Manual override is a DISTINCT flag rather than "is gtl_ui_scale present",
 * because older builds auto-persisted that value for everyone — keying off it
 * would strand existing users on a stale manual zoom instead of auto-fit.
 */
const MANUAL_KEY = 'gtl_ui_manual';

const RESIZE_DEBOUNCE_MS = 150;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function clamp(v: number): number {
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(v * 100) / 100));
}

/** Scale-to-fill for wide viewports; never shrinks below 1. */
function autoFitScale(): number {
  const w = window.innerWidth || document.documentElement.clientWidth || 1000;
  return Math.min(UI_SCALE_MAX, Math.max(1, Math.round((w / AUTOFIT_REF) * 100) / 100));
}

class UiScaleStore {
  scale = $state(1);
  manual = $state(false);

  constructor() {
    this.manual = read(MANUAL_KEY) === '1';
    const stored = parseFloat(read(SCALE_KEY) ?? '');
    this.scale = this.manual && Number.isFinite(stored) ? clamp(stored) : autoFitScale();
  }

  set(value: number, persist = true): void {
    this.scale = clamp(value);
    if (!persist) return;
    this.manual = true;
    try {
      localStorage.setItem(SCALE_KEY, String(this.scale));
      localStorage.setItem(MANUAL_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  nudge(delta: number): void {
    this.set(this.scale + delta);
  }

  /** Drop back to auto-fit. */
  reset(): void {
    this.manual = false;
    try {
      localStorage.removeItem(SCALE_KEY);
      localStorage.removeItem(MANUAL_KEY);
    } catch {
      /* ignore */
    }
    this.scale = autoFitScale();
  }

  /** Re-fit on resize, but only while the player hasn't set a manual zoom. */
  watchResize(): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (this.manual) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.scale = autoFitScale();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }

  /** Apply the current scale to the document. */
  apply(): void {
    const root = document.documentElement;
    const app = document.getElementById('app');
    const s = this.scale;
    const scaled = Math.abs(s - 1) > 0.001;

    root.style.setProperty('--ui-scale', String(s));
    root.classList.toggle('ui-scaled', scaled);
    if (!app) return;

    if (scaled) {
      app.style.transformOrigin = '0 0';
      app.style.transform = `scale(${s})`;
      app.style.width = `calc(100% / ${s})`;
      app.style.minHeight = `calc((100vh - var(--tb-h, 0px)) / ${s})`;
      app.style.height = 'auto';
      app.style.overflow = 'visible';
      app.style.display = 'block';
    } else {
      app.style.transform = '';
      app.style.transformOrigin = '';
      app.style.width = '';
      app.style.minHeight = '';
      app.style.height = '';
      app.style.overflow = '';
      app.style.display = '';
    }
  }
}

export const uiScale = new UiScaleStore();
