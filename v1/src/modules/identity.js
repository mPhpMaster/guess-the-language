import { updateAdminButton } from './admin.js';
import { $, announce } from './dom.js';
import { t } from './i18n.js';
import { applySettingsToUI, getPlayerNameInputValue } from './settings.js';
import { defaultSettings, state, store } from './state.js';

// ============================================================
//  Settings
// ============================================================
export function getSettings() {
    return Object.assign({}, defaultSettings, store.settings);
}

// Normalise a display name: collapse runs of whitespace to one space, trim, and
// cap at 24 code points — so names padded with spaces (or ending in an emoji)
// aren't chopped mid-character and still fit the leaderboard's 24-char limit.
export function sanitizeName(raw) {
    const collapsed = String(raw || '').replace(/\s+/g, ' ').trim();
    return Array.from(collapsed).slice(0, 24).join('');
}

export const BLOCKED_NAME_PATTERNS = [
    /fuck|fuk|shit|bitch|cunt|nigg|whore|porn|sex/,
    /نيك|كس|قحبة|شرموط|زب/
];

export const NAME_CONFUSABLES = {
    '0': 'o', '4': 'a', '3': 'e', '@': 'a',
    'ᶠ': 'f', 'ᶸ': 'u', 'ᶜ': 'c', 'ᵏ': 'k', 'ᵧ': 'y', 'ₒ': 'o', 'ᵤ': 'u',
    'ˢ': 's', 'ʰ': 'h', 'ⁱ': 'i', 'ᵗ': 't', 'ᵇ': 'b', 'ⁿ': 'n', 'ᵍ': 'g',
    'ʷ': 'w', 'ʳ': 'r', 'ᵖ': 'p', 'ᵉ': 'e', 'ˣ': 'x', 'ᴜ': 'u', 'γ': 'y'
};

export function normalizedNameForSafety(raw) {
    return sanitizeName(raw).normalize('NFKD').toLowerCase()
        .replace(/[043@ᶠᶸᶜᵏᵧₒᵤˢʰⁱᵗᵇⁿᵍʷʳᵖᵉˣᴜγ]/g, (c) => NAME_CONFUSABLES[c] || c)
        .replace(/[\u200B-\u200D\uFEFF\s_.\-]+/g, '')
        .replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

export function isSafePlayerName(raw) {
    const normalized = normalizedNameForSafety(raw);
    return !!normalized && !BLOCKED_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function safeDisplayName(raw) {
    const name = sanitizeName(raw);
    return isSafePlayerName(name) ? name : t('hiddenPlayer');
}

export function isDiscordActivity() {
    return Boolean(window.DISCORD_ACTIVITY?.active);
}

export function getDiscordDisplayName() {
    const user = window.DISCORD_ACTIVITY?.user;
    if (!user) return null;
    const name = user.global_name || user.username;
    return name ? sanitizeName(name) : null;
}

export function syncDiscordNameField() {
    const nameInput = $('#set-name');
    const nameLabel = $('#set-name-label');
    if (!nameInput || !nameLabel) return;

    // Lock the name field whenever the player is signed in through Discord —
    // either an Activity (SDK) or a web "Login with Discord".
    const profile = getDiscordProfile();
    if (profile) {
        if (profile.name) nameInput.value = profile.name;
        nameInput.disabled = true;
        nameInput.classList.add('discord-locked');
        nameLabel.textContent = t('settingNameDiscord');
    } else {
        nameInput.disabled = false;
        nameInput.classList.remove('discord-locked');
        nameLabel.setAttribute('data-i18n', 'settingName');
        nameLabel.textContent = t('settingName');
    }
}

export function getLinkedDiscordUser() {
    try {
        return JSON.parse(localStorage.getItem('gtl_discord_user')) || null;
    } catch {
        return null;
    }
}

export function isDiscordLinked() {
    return isDiscordActivity() || !!getLinkedDiscordUser();
}

// Running inside a Discord Activity iframe, whether or not the SDK handshake
// succeeded. Checked from the URL directly (not just the flag set by
// discord-activity.js) so it holds no matter which script ran first.
export function isDiscordEmbedded() {
    if (window.DISCORD_ACTIVITY?.embedded) return true;
    if (document.documentElement.classList.contains('platform-discord')) return true;
    try {
        if (location.pathname.startsWith('/.proxy')) return true;
        const params = new URLSearchParams(location.search);
        return params.has('frame_id') || params.has('instance_id');
    } catch {
        return false;
    }
}

// On the plain web build a Discord sign-in is required before playing (inside an
// Activity you're already signed in; Electron can't do the OAuth redirect).
// Never gate inside a Discord iframe: the sign-in is a top-level OAuth redirect,
// which Discord's sandbox blocks — gating there would leave the player stuck on
// a "Sign in to play" button that can never succeed.
export function requiresDiscordLogin() {
    return document.documentElement.classList.contains('platform-web')
        && !isDiscordActivity()
        && !isDiscordEmbedded();
}

// Can the player start a game right now?
export function canPlay() {
    if (requiresDiscordLogin()) return isDiscordLinked();
    return isDiscordActivity() || !!getPlayerNameInputValue();
}

// A unified Discord profile { id, name, avatar } from either the Activity SDK
// or a web "Login with Discord".
export function getDiscordProfile() {
    if (isDiscordActivity()) {
        const u = window.DISCORD_ACTIVITY.user;
        if (u) return { id: u.id, name: sanitizeName(u.global_name || u.username || ''), avatar: u.avatar || null };
    }
    return getLinkedDiscordUser();
}

export function getAppSessionToken() {
    return isDiscordActivity()
        ? (window.DISCORD_ACTIVITY?.sessionToken || null)
        : (getLinkedDiscordUser()?.sessionToken || null);
}

export function appApiPrefix() {
    if (location.pathname.startsWith('/.proxy') || new URLSearchParams(location.search).has('frame_id')) return '/.proxy';
    return '';
}

export function discordAvatarUrl(user, size = 64) {
    if (user && user.id && user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
    }
    return null;
}

// Load an image for canvas compositing (share card). crossOrigin lets us read the
// pixels back without tainting the canvas; resolves null on any failure.
export function loadCrossOriginImage(src) {
    return new Promise((resolve) => {
        if (!src) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Show the signed-in Discord user's avatar + name on the home screen, or a
// "Sign in with Discord to play" call-to-action when sign-in is required.
export function updateHomeProfile() {
    const el = $('#home-profile');
    const profile = getDiscordProfile();
    if (el) {
        if (profile && profile.name) {
            const img = $('#home-profile-avatar');
            const url = discordAvatarUrl(profile);
            if (img) {
                if (url) {
                    img.src = url;
                    img.classList.remove('hidden');
                } else {
                    img.classList.add('hidden');
                }
            }
            const nameEl = $('#home-profile-name');
            if (nameEl) nameEl.textContent = safeDisplayName(profile.name);
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
    const signedOutWeb = requiresDiscordLogin() && !isDiscordLinked();
    const cta = $('#home-login-cta');
    if (cta) cta.classList.add('hidden');
    $('#web-auth-hint')?.classList.toggle('hidden', !signedOutWeb);
    updateAdminButton();
}

// Web login only: unlink the Discord account so the name is editable again.
export function discordLogout() {
    localStorage.removeItem('gtl_discord_user');
    applySettingsToUI();
    updateHomeProfile();
}

// Show the player's real Discord avatar + name in the in-game HUD.
export function updateInGameProfile() {
    const el = $('#game-player');
    if (!el) return;
    const profile = getDiscordProfile();
    if (profile && profile.name) {
        const img = $('#game-player-avatar');
        const url = discordAvatarUrl(profile);
        if (img) {
            if (url) {
                img.src = url;
                img.classList.remove('hidden');
            } else {
                img.classList.add('hidden');
            }
        }
        const nameEl = $('#game-player-name');
        if (nameEl) nameEl.textContent = profile.name;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// The "Login with Discord" button is only useful on the plain web build: the
// Electron file:// origin can't be an OAuth redirect target, and inside a
// Discord Activity the name is already filled from the SDK.
export function updateDiscordLoginButton() {
    const loginBtn = $('#btn-discord-login');
    const logoutBtn = $('#btn-discord-logout');
    const status = $('#discord-login-status');
    const web = document.documentElement.classList.contains('platform-web');
    const configured = !!(window.DISCORD_CONFIG && window.DISCORD_CONFIG.clientId);
    // Also hidden inside a Discord iframe: the OAuth redirect can't run there.
    const area = web && configured && !isDiscordActivity() && !isDiscordEmbedded();
    const linked = getLinkedDiscordUser();

    // Signed out -> show Login; signed in -> show Logout instead.
    if (loginBtn) loginBtn.classList.toggle('hidden', !(area && !linked));
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !(area && linked));
    if (status) {
        if (area && linked && linked.name) {
            status.textContent = `${t('discordLinkedAs')} ${linked.name}`;
            status.classList.remove('hidden');
        } else {
            status.classList.add('hidden');
        }
    }
}

// Kick off the Discord OAuth2 authorization-code flow (a full-page redirect).
export function startDiscordLogin() {
    const clientId = window.DISCORD_CONFIG && window.DISCORD_CONFIG.clientId;
    if (!clientId) return;
    const redirectUri = location.origin + location.pathname;
    const state = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    sessionStorage.setItem('gtl_discord_oauth_state', state);
    sessionStorage.setItem('gtl_discord_return_search', location.search || '');
    $('#auth-error')?.classList.add('hidden');
    location.href = 'https://discord.com/api/oauth2/authorize'
        + `?client_id=${encodeURIComponent(clientId)}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + '&response_type=code&scope=identify'
        + `&state=${encodeURIComponent(state)}`;
}

// On boot, complete a login if we've just been redirected back with a ?code.
export async function handleDiscordOAuthReturn() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;

    const savedState = sessionStorage.getItem('gtl_discord_oauth_state');
    sessionStorage.removeItem('gtl_discord_oauth_state');
    // Strip the OAuth params from the address bar no matter what happens next.
    const cleanUrl = location.origin + location.pathname;
    const returnSearch = sessionStorage.getItem('gtl_discord_return_search') || '';
    sessionStorage.removeItem('gtl_discord_return_search');
    try {
        window.history.replaceState({}, document.title, cleanUrl + returnSearch);
    } catch (e) {
        /* ignore */
    }

    if (!savedState || savedState !== params.get('state')) {
        console.warn('Discord OAuth state mismatch — ignoring callback');
        showAuthError(t('discordLoginFailed'));
        return false;
    }

    try {
        const res = await fetch('/api/discord-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: cleanUrl })
        });
        if (!res.ok) throw new Error(`login failed (${res.status})`);
        const user = await res.json();
        const name = sanitizeName(user.global_name || user.username || '');
        if (!name) throw new Error('missing username');
        const cur = getSettings();
        cur.name = name;
        store.settings = cur;
        localStorage.setItem('gtl_discord_user', JSON.stringify({
            id: user.id,
            name,
            avatar: user.avatar || null,
            sessionToken: user.session_token || null
        }));
        return true;
    } catch (e) {
        console.error('Discord login:', e);
        showAuthError(t('discordLoginFailed'));
        return false;
    }
}

export function showAuthError(message) {
    const box = $('#auth-error');
    const text = $('#auth-error-text');
    if (text) text.textContent = message;
    box?.classList.remove('hidden');
    announce(message);
}
