import { insert, supabaseConfigured } from './supabase';

/**
 * Best-effort client error logging into the `error_logs` table.
 *
 * Every path here is wrapped: logging must never throw, and must never call
 * `console.error` (the hook below wraps it, so that would recurse).
 */

export interface LogExtra {
  level?: 'error' | 'warn' | 'info';
  source?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

let appVersion: string | null = typeof __GTL_VERSION__ === 'string' ? __GTL_VERSION__ : null;
let installed = false;

/** One entry per unique (source, message) per 15s, so a loop can't flood the table. */
const throttle = new Map<string, number>();
const THROTTLE_MS = 15_000;

/** Supplied by the app so the log rows carry who/where without a circular import. */
let contextProvider: () => Record<string, unknown> = () => ({});

export function setLogContextProvider(fn: () => Record<string, unknown>): void {
  contextProvider = fn;
}

function detectPlatform(): string {
  try {
    if (window.DISCORD_ACTIVITY?.active) return 'discord';
    if (/electron/i.test(navigator.userAgent)) return 'electron';
  } catch {
    /* ignore */
  }
  return 'web';
}

export function logError(message: unknown, extra: LogExtra = {}): void {
  try {
    if (!supabaseConfigured()) return;

    const raw = message instanceof Error ? message.message : message;
    const msg = String(raw ?? 'unknown error').slice(0, 2000);
    if (!msg || msg === 'null' || msg === 'undefined') return;

    const key = `${extra.source ?? ''}|${msg.slice(0, 180)}`;
    const now = Date.now();
    if (now - (throttle.get(key) ?? 0) < THROTTLE_MS) return;
    throttle.set(key, now);

    let extraContext: Record<string, unknown> = {};
    try {
      extraContext = contextProvider();
    } catch {
      /* a broken provider must not stop the log */
    }

    const row = {
      level: extra.level ?? 'error',
      source: extra.source ?? 'manual',
      message: msg,
      stack: extra.stack ? String(extra.stack).slice(0, 8000) : null,
      app_version: appVersion,
      platform: detectPlatform(),
      url: (() => {
        try {
          return location.href;
        } catch {
          return null;
        }
      })(),
      context: { ua: navigator.userAgent, ...extraContext, ...(extra.context ?? {}) }
    };

    void insert('error_logs', [row]).catch(() => {});
  } catch {
    /* logging must never break the app */
  }
}

export function setupErrorLogging(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e) => {
    logError(e.message || e.error || 'window error', {
      source: 'window.onerror',
      stack: e.error?.stack,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno }
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logError(r?.message ?? r ?? 'unhandled promise rejection', {
      source: 'unhandledrejection',
      stack: r?.stack
    });
  });

  // Route console.error through the logger so caught-and-reported failures —
  // exactly the ones worth debugging — are captured too.
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const text = args
        .map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a)))
        .join(' ');
      logError(text, { source: 'console.error' });
    } catch {
      /* ignore */
    }
  };
}

/** Exposed for the Discord bootstrap, which logs before the app mounts. */
export function exposeGlobalLogger(): void {
  window.GTL_LOG_ERROR = logError;
}
