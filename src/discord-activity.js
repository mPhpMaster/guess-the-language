import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';

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

  // Route Supabase (REST + realtime WebSocket) through the Activity proxy —
  // external hosts are otherwise blocked by Discord's iframe sandbox
  // ("TypeError: Failed to fetch"). Requires a matching URL Mapping in the
  // Discord Developer Portal: prefix "/supabase" -> the Supabase host.
  try {
    const supaUrl = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url;
    if (supaUrl) {
      const supaHost = new URL(supaUrl).host;
      patchUrlMappings([{ prefix: '/supabase', target: supaHost }]);
      console.info('[discord] proxying Supabase via /supabase ->', supaHost);
    }
  } catch (e) {
    console.warn('[discord] Supabase proxy mapping failed:', e);
  }

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
  // Open Discord's native "share" sheet so the player can send a challenge
  // straight to a friend's DM (or a channel). `payload` is embedded in the deep
  // link as custom_id; when the friend launches the Activity from that message
  // it arrives back as `customId` below. Returns the SDK response ({ success,
  // didSendMessage, ... }) or null if the command isn't available.
  shareLink(message, payload) {
    const sdk = window.DISCORD_ACTIVITY._session?.sdk;
    if (sdk?.commands?.shareLink) {
      const args = { message: String(message).slice(0, 1000) };
      if (payload) args.custom_id = String(payload).slice(0, 64);
      return sdk.commands.shareLink(args);
    }
    return null;
  },
  // custom_id carried in by a challenge deep link (null when launched normally).
  get customId() {
    return window.DISCORD_ACTIVITY._session?.sdk?.customId ?? null;
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
