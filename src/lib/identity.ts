import { createSignal } from 'solid-js';
import { discordActivity } from './discord';
import { isDiscordEmbed, isWebBuild } from './platform';
import { isRecord, readJson, readString, removeKey, writeJson } from './storage';
import { isSafePlayerName, sanitizeName } from './names';
import { settings, updateSettings } from './settings';
import type { DiscordProfile, SessionClaims } from '../types/models';

const LINKED_USER_KEY = 'gtl_discord_user';

function isLinkedUser(value: unknown): value is DiscordProfile {
    return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

const [linkedUser, setLinkedUser] = createSignal<DiscordProfile | null>(
    readJson(LINKED_USER_KEY, isLinkedUser),
);

export { linkedUser };

export function storeLinkedUser(profile: DiscordProfile): void {
    writeJson(LINKED_USER_KEY, profile);
    setLinkedUser(profile);
}

export function clearLinkedUser(): void {
    removeKey(LINKED_USER_KEY);
    setLinkedUser(null);
}

/** A unified profile from either the Activity SDK or a web "Login with Discord". */
export function discordProfile(): DiscordProfile | null {
    if (discordActivity.active) {
        const user = discordActivity.user;
        if (user) {
            return {
                id: user.id,
                name: sanitizeName(user.global_name ?? user.username),
                avatar: user.avatar ?? null,
            };
        }
    }
    return linkedUser();
}

export function isDiscordLinked(): boolean {
    return discordActivity.active || linkedUser() !== null;
}

export function discordAvatarUrl(
    user: { readonly id?: string; readonly avatar?: string | null } | null,
    size = 64,
): string | null {
    if (!user?.id || !user.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
}

export function ownAvatarUrl(size = 64): string | null {
    return discordAvatarUrl(discordProfile(), size);
}

export function participantAvatarUrl(userId: string | null): string | null {
    const participant = discordActivity.participant(userId);
    if (!participant) return null;
    return discordAvatarUrl({ id: participant.id, avatar: participant.avatar ?? null });
}

/**
 * On the plain web build a Discord sign-in is required before playing. Never
 * gate inside a Discord iframe: the sign-in is a top-level OAuth redirect, which
 * Discord's sandbox blocks, so gating there would strand the player.
 */
export function requiresDiscordLogin(): boolean {
    return isWebBuild() && !discordActivity.active && !isDiscordEmbed();
}

/**
 * The name typed into settings, or the Discord one when signed in.
 *
 * Reads the unified profile rather than only the Activity SDK: on web and in
 * Electron a player can be linked via "Login with Discord" with no Activity at
 * all, and returning '' there made canPlay() false — a linked player who never
 * typed a name could not start a game.
 */
export function localPlayerNameInput(): string {
    const profile = discordProfile();
    if (profile) return sanitizeName(profile.name);
    return sanitizeName(settings().name);
}

/** Leaderboard identity. Falls back to "User". */
export function playerName(): string {
    const profile = discordProfile();
    if (profile?.name) {
        return isSafePlayerName(profile.name)
            ? sanitizeName(profile.name)
            : `Player ${profile.id.slice(-4) || 'User'}`;
    }
    return localPlayerNameInput() || 'User';
}

/** Can the player start a game right now? */
export function canPlay(): boolean {
    if (requiresDiscordLogin()) return isDiscordLinked();
    return discordActivity.active || localPlayerNameInput().length > 0;
}

export function appSessionToken(): string | null {
    return discordActivity.active
        ? discordActivity.sessionToken
        : (linkedUser()?.sessionToken ?? null);
}

function base64UrlDecode(input: string): string {
    let text = input.replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4 !== 0) text += '=';
    return atob(text);
}

/**
 * Read (not verify — the server verifies) the session token's claims, so the UI
 * can decide whether to show the admin entry point.
 */
export function sessionClaims(): SessionClaims | null {
    try {
        const token = appSessionToken();
        if (!token) return null;
        const head = token.split('.')[0];
        if (!head) return null;
        const parsed: unknown = JSON.parse(base64UrlDecode(head));
        return isRecord(parsed) ? (parsed as SessionClaims) : null;
    } catch {
        return null;
    }
}

export function isAdmin(): boolean {
    return sessionClaims()?.adm === true;
}

/* ---------------- Generated fallback avatars (no emoji) ---------------- */

const AVATAR_PALETTE: readonly string[] = [
    '#2ec5ff',
    '#19f0c4',
    '#ffd874',
    '#ff7a9c',
    '#b18cff',
    '#5fd0ff',
    '#25d07d',
    '#ff9f5a',
    '#f78fff',
    '#8cff6b',
];

function hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash;
}

/** Stable accent colour for a player without a real avatar. */
export function avatarColorFor(name: string): string {
    const palette = AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
    return palette ?? '#2ec5ff';
}

/** Up to two initials, used inside the generated avatar badge. */
export function initialsFor(name: string): string {
    const clean = sanitizeName(name);
    const words = clean.split(' ').filter((w) => w.length > 0);
    const first = words[0]?.[0] ?? '?';
    const second = words[1]?.[0] ?? '';
    return (first + second).toUpperCase();
}

/* ---------------- Web OAuth (plain browser build only) ---------------- */

const OAUTH_STATE_KEY = 'gtl_discord_oauth_state';
const OAUTH_RETURN_KEY = 'gtl_discord_return_search';
/** Read by v1 after it completes an OAuth round trip started from this build. */
const LOGIN_RETURN_KEY = 'gtl_login_return_to';

export function discordLoginAvailable(): boolean {
    return (
        isWebBuild() &&
        Boolean(window.DISCORD_CONFIG?.clientId) &&
        !discordActivity.active &&
        !isDiscordEmbed()
    );
}

export function startDiscordLogin(): void {
    const clientId = window.DISCORD_CONFIG?.clientId;
    if (!clientId) return;
    // Discord matches redirect URIs exactly and only the deployment ROOT is
    // registered. This build is served from /v2/, so redirecting back here would be
    // rejected outright. Route the round trip through the root instead: v1 completes
    // the exchange and stores the profile on this same origin — where this build
    // already reads it — then follows the breadcrumb below back to /v2/.
    const redirectUri = `${window.location.origin}/`;
    const state = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    try {
        window.sessionStorage.setItem(OAUTH_STATE_KEY, state);
        window.sessionStorage.setItem(OAUTH_RETURN_KEY, window.location.search);
        window.sessionStorage.setItem(LOGIN_RETURN_KEY, window.location.pathname);
    } catch {
        /* ignore */
    }
    window.location.href =
        'https://discord.com/api/oauth2/authorize' +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        '&response_type=code&scope=identify' +
        `&state=${encodeURIComponent(state)}`;
}

export function discordLogout(): void {
    clearLinkedUser();
}

interface DiscordLoginResponse {
    readonly id?: string;
    readonly username?: string;
    readonly global_name?: string | null;
    readonly avatar?: string | null;
    readonly session_token?: string | null;
}

/**
 * Complete a login if we've just been redirected back with a `?code`.
 * Returns an error message when the exchange failed, else null.
 */
export async function handleDiscordOAuthReturn(): Promise<string | null> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return null;

    const savedState = readString(OAUTH_STATE_KEY);
    let sessionState: string | null = null;
    try {
        sessionState = window.sessionStorage.getItem(OAUTH_STATE_KEY);
        window.sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
        /* ignore */
    }
    const expectedState = sessionState ?? savedState;

    const cleanUrl = window.location.origin + window.location.pathname;
    let returnSearch = '';
    try {
        returnSearch = window.sessionStorage.getItem(OAUTH_RETURN_KEY) ?? '';
        window.sessionStorage.removeItem(OAUTH_RETURN_KEY);
    } catch {
        /* ignore */
    }
    try {
        window.history.replaceState({}, document.title, cleanUrl + returnSearch);
    } catch {
        /* ignore */
    }

    if (!expectedState || expectedState !== params.get('state')) {
        return 'state-mismatch';
    }

    try {
        const res = await fetch('/api/discord-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: cleanUrl }),
        });
        if (!res.ok) throw new Error(`login failed (${res.status})`);
        const user = (await res.json()) as DiscordLoginResponse;
        const name = sanitizeName(user.global_name ?? user.username ?? '');
        if (!name || !user.id) throw new Error('missing username');
        updateSettings({ name });
        storeLinkedUser({
            id: user.id,
            name,
            avatar: user.avatar ?? null,
            sessionToken: user.session_token ?? null,
        });
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
}
