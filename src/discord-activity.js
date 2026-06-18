import { DiscordSDK } from '@discord/embedded-app-sdk';

const clientId =
  import.meta.env.VITE_DISCORD_CLIENT_ID || window.DISCORD_CONFIG?.clientId;

/** Discord proxies API calls through /.proxy when URL mapping is configured. */
function discordProxyPrefix() {
  if (window.location.pathname.startsWith('/.proxy')) return '/.proxy';
  const params = new URLSearchParams(window.location.search);
  if (params.has('frame_id')) return '/.proxy';
  return '';
}

async function setupDiscordActivity() {
  if (!clientId) {
    return null;
  }

  const discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'applications.commands']
  });

  const prefix = discordProxyPrefix();
  const tokenRes = await fetch(`${prefix}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Token exchange failed');
  }

  const { access_token } = await tokenRes.json();
  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error('Discord authenticate command failed');
  }

  document.documentElement.classList.add('platform-discord');

  return { sdk: discordSdk, auth };
}

window.DISCORD_ACTIVITY = {
  ready: null,
  get user() {
    return window.DISCORD_ACTIVITY._session?.auth?.user ?? null;
  },
  get active() {
    return Boolean(window.DISCORD_ACTIVITY._session);
  },
  _session: null
};

window.DISCORD_ACTIVITY.ready = (async () => {
  try {
    const session = await setupDiscordActivity();
    window.DISCORD_ACTIVITY._session = session;
    return session;
  } catch (err) {
    console.warn('Discord Activity setup skipped:', err.message);
    window.DISCORD_ACTIVITY._session = null;
    return null;
  }
})();
