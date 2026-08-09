import { sanitizeName } from '$lib/game/names';
import { settings } from '$lib/state/settings.svelte';
import { inDiscordEmbed, linkedDiscordUser, type DiscordProfile } from './discord.svelte';

/**
 * "Login with Discord" for the plain WEB build.
 *
 * This is the standard OAuth2 authorization-code flow (a top-level redirect),
 * NOT the Embedded App SDK handshake — the two are deliberately separate:
 *
 *   - Inside a Discord Activity the identity already comes from the SDK, and a
 *     top-level redirect is blocked by Discord's sandbox anyway. Offering the
 *     button there would strand the player on a sign-in that can never succeed.
 *   - In Electron the app is served from file://, which cannot be a registered
 *     OAuth redirect target.
 *
 * So the whole flow is gated on being on the real web build.
 */

const LINKED_KEY = 'gtl_discord_user';
const STATE_KEY = 'gtl_discord_oauth_state';
const RETURN_KEY = 'gtl_discord_return_search';

class AuthState {
  /** Non-null after a failed sign-in; the home screen surfaces it with a retry. */
  error = $state<string | null>(null);
  /** Bumped after a successful sign-in / sign-out so readers recompute. */
  revision = $state(0);
}

export const auth = new AuthState();

/** True on the plain web build, where a Discord sign-in is possible and required. */
export function discordLoginAvailable(): boolean {
  return (
    document.documentElement.classList.contains('platform-web') &&
    !inDiscordEmbed() &&
    !!window.DISCORD_CONFIG?.clientId
  );
}

/**
 * Whether the player must sign in before playing.
 *
 * Never true inside the Activity or in Electron — see the note above. Reads
 * `auth.revision` so signing in or out re-renders the gate.
 */
export function requiresDiscordLogin(): boolean {
  auth.revision;
  return discordLoginAvailable() && !linkedDiscordUser();
}

/** The signed-in web profile, if any. */
export function webProfile(): DiscordProfile | null {
  auth.revision;
  return linkedDiscordUser();
}

/** Kick off the authorization-code flow (a full-page redirect). */
export function startDiscordLogin(): void {
  const clientId = window.DISCORD_CONFIG?.clientId;
  if (!clientId) return;
  // Must match a URI registered under the app's OAuth2 -> Redirects, so the
  // query string is stripped here and restored on return.
  const redirectUri = location.origin + location.pathname;
  const state = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, location.search || '');
  } catch {
    /* private mode — the state check below will simply fail closed */
  }
  auth.error = null;
  location.href =
    'https://discord.com/api/oauth2/authorize' +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=code&scope=identify' +
    `&state=${encodeURIComponent(state)}`;
}

/**
 * Complete a sign-in when the page has just been redirected back with a ?code.
 * Call once during boot, before mounting. Resolves true when a session landed.
 */
export async function handleDiscordOAuthReturn(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return false;

  let savedState: string | null = null;
  let returnSearch = '';
  try {
    savedState = sessionStorage.getItem(STATE_KEY);
    returnSearch = sessionStorage.getItem(RETURN_KEY) || '';
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }

  // Strip the OAuth params from the address bar no matter what happens next, so
  // a refresh cannot replay a spent code.
  const cleanUrl = location.origin + location.pathname;
  try {
    window.history.replaceState({}, document.title, cleanUrl + returnSearch);
  } catch {
    /* ignore */
  }

  // CSRF guard: the state we generated must come back untouched.
  if (!savedState || savedState !== params.get('state')) {
    console.warn('Discord OAuth state mismatch — ignoring callback');
    auth.error = 'discordLoginFailed';
    return false;
  }

  try {
    const res = await fetch('/api/discord-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: cleanUrl })
    });
    if (!res.ok) throw new Error(`login failed (${res.status})`);
    const user = (await res.json()) as {
      id: string;
      username?: string;
      global_name?: string;
      avatar?: string | null;
      session_token?: string | null;
    };
    const name = sanitizeName(user.global_name || user.username || '');
    if (!name) throw new Error('missing username');

    settings.setName(name);
    localStorage.setItem(
      LINKED_KEY,
      JSON.stringify({
        id: user.id,
        name,
        avatar: user.avatar ?? null,
        sessionToken: user.session_token ?? null
      })
    );
    auth.revision++;
    return true;
  } catch (err) {
    console.error('Discord login:', err);
    auth.error = 'discordLoginFailed';
    return false;
  }
}

/**
 * Drop a stored web sign-in whose session token has aged out.
 *
 * Session tokens last a week and are only minted at sign-in — there is no
 * refresh. Keeping an expired one around leaves the app looking signed in while
 * every authenticated call (reports, admin) fails with 401. Clearing it puts the
 * player back in front of the sign-in button, which re-mints everything.
 */
export function purgeExpiredSession(): void {
  const user = linkedDiscordUser();
  if (!user?.sessionToken) return;
  try {
    const payload = user.sessionToken.split('.')[0] ?? '';
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const { exp } = JSON.parse(atob(b64)) as { exp?: number };
    if (exp && exp > Math.floor(Date.now() / 1000)) return;
  } catch {
    // An unreadable token is no more usable than an expired one.
  }
  console.info('[auth] stored Discord session expired — signing out');
  discordLogout();
}

/** Forget the web sign-in. The Activity identity is unaffected. */
export function discordLogout(): void {
  try {
    localStorage.removeItem(LINKED_KEY);
  } catch {
    /* ignore */
  }
  auth.error = null;
  auth.revision++;
}
