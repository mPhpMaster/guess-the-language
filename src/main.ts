import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { exposeGlobalLogger, setupErrorLogging } from '$lib/services/errors';
import { inDiscordEmbed, ready as discordReady } from '$lib/services/discord.svelte';
import { handleDiscordOAuthReturn, purgeExpiredSession } from '$lib/services/discordLogin.svelte';

// Install the error hooks before anything else so a failure during boot is still
// reported to `error_logs`.
exposeGlobalLogger();
setupErrorLogging();

/**
 * app.css branches on these classes (compact Discord layout, hidden window
 * controls on web), so they must be set before the first paint.
 */
document.documentElement.classList.add(
  inDiscordEmbed() ? 'platform-discord' : window.appWindow ? 'platform-electron' : 'platform-web'
);

const target = document.getElementById('app');
if (!target) throw new Error('#app mount point is missing');

/**
 * Complete a "Login with Discord" redirect before mounting, so the app never
 * renders a signed-out home screen for a player who is one await away from being
 * signed in — and so the spent ?code is out of the address bar before any other
 * code reads location.search. A no-op when there is no ?code.
 */
await handleDiscordOAuthReturn();

// A week-old session token still looks like a sign-in but is rejected by every
// authenticated endpoint. Clear it before mounting so the UI offers a fresh
// sign-in rather than failing later with "Authentication required".
purgeExpiredSession();

/**
 * Inside the Discord Activity the handshake must finish before the app mounts:
 * it installs the URL mapping that makes Supabase reachable from the iframe, and
 * it resolves the player's identity. Mounting first would let the home screen
 * fire unproxied requests that Discord's CSP blocks outright.
 *
 * On web and in Electron `discordReady` is already resolved, so this costs
 * nothing and the app mounts synchronously.
 */
if (inDiscordEmbed()) await discordReady;

export default mount(App, { target });

/**
 * Register the service worker so the web build is an installable PWA that also
 * works offline. Skipped on file:// (Electron) and inside iframes (the Discord
 * Activity), where a worker is unwanted and would fight Discord's proxy.
 *
 * Production only: in dev the worker's cache-first strategy shadows Vite's
 * module graph and keeps serving a stale bundle across reloads, which looks
 * exactly like edits silently not applying.
 */
const inIframe = window.top !== window.self;
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !inIframe) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
