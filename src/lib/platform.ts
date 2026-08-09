import type { Platform } from '../types/models';

/** The deployed web address, used when the current origin isn't shareable. */
export const GAME_PUBLIC_URL = 'https://guess-the-language-chi.vercel.app/';

export const APP_VERSION: string = __APP_VERSION__;

/**
 * Running inside a Discord Activity iframe — decided from the URL alone, so it
 * stays true even when the SDK handshake later fails. The app needs this to know
 * it must NOT fall back to the plain-web login flow: a top-level OAuth redirect
 * cannot work inside Discord's sandboxed iframe.
 */
export function isDiscordEmbed(): boolean {
    try {
        if (window.location.pathname.startsWith('/.proxy')) return true;
        const params = new URLSearchParams(window.location.search);
        return params.has('frame_id') || params.has('instance_id');
    } catch {
        return false;
    }
}

export function isElectron(): boolean {
    return typeof window.appWindow?.minimize === 'function' && !isDiscordEmbed();
}

export function isWebBuild(): boolean {
    return !isElectron() && !isDiscordEmbed();
}

export function currentPlatform(): Platform {
    if (isDiscordEmbed()) return 'discord';
    if (isElectron()) return 'electron';
    return 'web';
}

/** Discord proxies same-origin API calls through `/.proxy` when URL mapping is on. */
export function apiPrefix(): string {
    return isDiscordEmbed() ? '/.proxy' : '';
}

/** Public base URL for shareable links. */
export function shareBaseUrl(): string {
    if (!isWebBuild()) return GAME_PUBLIC_URL;
    return (window.location.origin + window.location.pathname).replace(/index\.html?$/i, '');
}

/**
 * Open an external URL the right way for the current platform: through the
 * Discord SDK inside an Activity (window.open is sandboxed there), the OS browser
 * via Electron, or a synthetic anchor click on the web (not treated as a popup).
 */
export function openExternalUrl(url: string, viaDiscord?: (url: string) => void): void {
    if (!url) return;
    if (isDiscordEmbed() && viaDiscord) {
        viaDiscord(url);
        return;
    }
    if (isElectron() && window.appWindow) {
        window.appWindow.openExternal(url);
        return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

/**
 * Go back to the original app. This build is served from /v2/ of the v1
 * deployment, so v1 is simply the parent path — same origin, which keeps the
 * Discord Activity alive. Carrying location.search over hands v1 the
 * frame_id / instance_id / platform params it needs to re-run its SDK handshake.
 */
export function openOldVersion(): void {
    if (isDiscordEmbed()) {
        const base = window.location.pathname.startsWith('/.proxy') ? '/.proxy/' : '/';
        window.location.href = base + window.location.search;
        return;
    }
    if (isWebBuild()) {
        window.location.href = '/';
        return;
    }
    // Electron ships no copy of v1, so open the public site instead.
    openExternalUrl(GAME_PUBLIC_URL);
}

export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
