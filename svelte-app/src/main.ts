import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { exposeGlobalLogger, setupErrorLogging } from '$lib/services/errors';
import { inDiscordEmbed, ready as discordReady } from '$lib/services/discord.svelte';

// Install the error hooks before anything else so a failure during boot is still
// reported to `error_logs`.
exposeGlobalLogger();
setupErrorLogging();

const target = document.getElementById('app');
if (!target) throw new Error('#app mount point is missing');

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
 */
const inIframe = window.top !== window.self;
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !inIframe) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
