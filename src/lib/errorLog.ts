import { sbFetch, supabaseConfigured } from './supabase';
import { APP_VERSION, currentPlatform } from './platform';

/* ============================================================
   Best-effort client error logging into Supabase `error_logs`.
   Must NEVER throw and never affect gameplay.
   ============================================================ */

export interface ErrorContext {
    readonly source?: string;
    readonly level?: 'error' | 'warn';
    readonly stack?: string | undefined;
    readonly context?: Readonly<Record<string, unknown>>;
}

type NameProvider = () => string | null;

let playerNameProvider: NameProvider = () => null;
let currentModeProvider: () => string | null = () => null;

export function configureErrorLogContext(
    name: NameProvider,
    mode: () => string | null,
): void {
    playerNameProvider = name;
    currentModeProvider = mode;
}

const THROTTLE_MS = 15_000;
const throttle = new Map<string, number>();

export function logError(message: unknown, extra: ErrorContext = {}): void {
    try {
        if (!supabaseConfigured()) return;
        const raw =
            message instanceof Error ? message.message : String(message ?? 'unknown error');
        const text = raw.slice(0, 2000);
        if (!text || text === 'null' || text === 'undefined') return;

        const key = `${extra.source ?? ''}|${text.slice(0, 180)}`;
        const now = Date.now();
        if (now - (throttle.get(key) ?? 0) < THROTTLE_MS) return;
        throttle.set(key, now);

        const row = {
            level: extra.level ?? 'error',
            source: extra.source ?? 'manual',
            message: text,
            stack: extra.stack ? extra.stack.slice(0, 8000) : null,
            app_version: APP_VERSION,
            platform: currentPlatform(),
            player: playerNameProvider(),
            url: window.location.href,
            context: {
                mode: currentModeProvider(),
                ua: navigator.userAgent,
                ...(extra.context ?? {}),
            },
        };
        void sbFetch('error_logs', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([row]),
        }).catch(() => undefined);
    } catch {
        /* logging must never break the app */
    }
}

let installed = false;

/**
 * Route uncaught errors, unhandled rejections and console.error into the log.
 * `logError` never calls console.error, so there is no recursion.
 */
export function installErrorLogging(): void {
    if (installed) return;
    installed = true;

    window.addEventListener('error', (event) => {
        logError(event.message || event.error, {
            source: 'window.onerror',
            stack: event.error instanceof Error ? event.error.stack : undefined,
            context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason: unknown = event.reason;
        logError(reason instanceof Error ? reason.message : reason, {
            source: 'unhandledrejection',
            stack: reason instanceof Error ? reason.stack : undefined,
        });
    });

    const original = console.error.bind(console);
    console.error = (...args: readonly unknown[]): void => {
        original(...args);
        try {
            const text = args
                .map((arg) =>
                    arg instanceof Error ? (arg.stack ?? arg.message) : String(arg),
                )
                .join(' ');
            logError(text, { source: 'console.error' });
        } catch {
            /* ignore */
        }
    };
}
