/**
 * localStorage access that can never throw (private mode, Discord's sandbox,
 * Electron file:// origins) and never returns an untyped value.
 */

export function readString(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeString(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        /* storage unavailable — the app works without persistence */
    }
}

export function removeKey(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

export function readJson<T>(key: string, guard: (value: unknown) => value is T): T | null {
    const raw = readString(key);
    if (raw === null) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return guard(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeJson(key: string, value: unknown): void {
    try {
        writeString(key, JSON.stringify(value));
    } catch {
        /* ignore */
    }
}

export function readNumber(key: string): number {
    const raw = readString(key);
    if (raw === null) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        // Heal a non-finite value written by the old practice ∞-timer bug.
        removeKey(key);
        return 0;
    }
    return value;
}

export function readSessionString(key: string): string | null {
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeSessionString(key: string, value: string): void {
    try {
        window.sessionStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

export function removeSessionKey(key: string): void {
    try {
        window.sessionStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
