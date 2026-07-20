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
    console.info('[discord] no clientId configured — running as a plain web app');
    return null;
  }

  console.info('[discord] initialising SDK…');
  const discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();
  console.info('[discord] SDK ready; authorizing…');

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'applications.commands']
  });
  console.info('[discord] authorized; exchanging token via', discordProxyPrefix() + '/api/token');

  const prefix = discordProxyPrefix();
  // Bound the token exchange so a request that never returns can't hang the
  // whole Activity init (it would otherwise leave the app unresponsive).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let tokenRes;
  try {
    tokenRes = await fetch(`${prefix}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    });
  } catch (err) {
    throw new Error(
      err.name === 'AbortError'
        ? 'Token exchange timed out — is /api/token deployed and reachable through the Discord proxy?'
        : `Token exchange request failed: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token exchange failed (${tokenRes.status})`);
  }

  const { access_token } = await tokenRes.json();
  console.info('[discord] token ok; authenticating…');
  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error('Discord authenticate command failed');
  }

  console.info('[discord] activity ready ✓');
  document.documentElement.classList.add('platform-discord');

  return {
    sdk: discordSdk,
    auth,
    instanceId: discordSdk.instanceId,
    channelId: discordSdk.channelId,
    guildId: discordSdk.guildId
  };
}

window.DISCORD_ACTIVITY = {
  ready: null,
  get user() {
    return window.DISCORD_ACTIVITY._session?.auth?.user ?? null;
  },
  get instanceId() {
    return window.DISCORD_ACTIVITY._session?.instanceId ?? null;
  },
  get active() {
    return Boolean(window.DISCORD_ACTIVITY._session);
  },
  // Open an external link from inside the Activity iframe. Plain window.open is
  // blocked by Discord's sandbox, so route it through the SDK command.
  openExternal(url) {
    const sdk = window.DISCORD_ACTIVITY._session?.sdk;
    if (sdk?.commands?.openExternalLink) {
      return sdk.commands.openExternalLink({ url });
    }
    return null;
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
