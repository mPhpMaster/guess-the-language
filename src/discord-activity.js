import { DiscordSDK, Events, patchUrlMappings } from '@discord/embedded-app-sdk';

const clientId =
  import.meta.env.VITE_DISCORD_CLIENT_ID || window.DISCORD_CONFIG?.clientId;

// `rpc.activities.write` is what lets us call setActivity() — it's the scope
// behind the "Playing … / Round 3 of 10 / Ask to Join" card on a member's
// Discord profile. It is requested as an extra on top of the scopes the game
// actually needs to run, so a rejection must never break the handshake.
const BASE_SCOPES = ['identify', 'applications.commands'];
const PRESENCE_SCOPE = 'rpc.activities.write';

/** Discord proxies API calls through /.proxy when URL mapping is configured. */
function discordProxyPrefix() {
  if (window.location.pathname.startsWith('/.proxy')) return '/.proxy';
  const params = new URLSearchParams(window.location.search);
  if (params.has('frame_id')) return '/.proxy';
  return '';
}

/**
 * True when the page is running inside a Discord Activity iframe — decided from
 * the URL alone, so it stays true even if the SDK handshake later fails. The app
 * needs this to know it must NOT fall back to the plain-web login flow: a
 * top-level OAuth redirect can't work inside Discord's sandboxed iframe, so
 * treating a failed handshake as "signed-out web user" makes the game unplayable.
 */
function inDiscordEmbed() {
  if (window.location.pathname.startsWith('/.proxy')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.has('frame_id') || params.has('instance_id');
}

/** Users currently connected to this Activity instance (for real avatars). */
let participants = [];

// ---------------------------------------------------------------------------
//  Rich presence
// ---------------------------------------------------------------------------
// Discord rate-limits SET_ACTIVITY, and the game wants to update on every
// question, answer and score change — far more often than that allows. So every
// push is coalesced: at most one command per PRESENCE_MIN_INTERVAL_MS, and the
// most recent payload is always the one that eventually lands (a trailing flush,
// not a drop). Identical consecutive payloads are skipped entirely.
const PRESENCE_MIN_INTERVAL_MS = 5000;
let presenceLastSentAt = 0;
let presenceLastPayload = '';
let presencePending;
let presencePendingSet = false;
let presenceTimer = null;

function presenceSdk() {
  const session = window.DISCORD_ACTIVITY?._session;
  if (!session || !session.presence) return null;
  return session.sdk?.commands?.setActivity ? session.sdk : null;
}

async function flushPresence() {
  presenceTimer = null;
  const sdk = presenceSdk();
  if (!sdk || !presencePendingSet) return;

  const activity = presencePending;
  presencePendingSet = false;
  presencePending = undefined;

  const key = JSON.stringify(activity ?? null);
  if (key === presenceLastPayload) return;
  presenceLastPayload = key;
  presenceLastSentAt = Date.now();
  try {
    await sdk.commands.setActivity({ activity: activity ?? null });
  } catch (e) {
    // A rejected update must not break gameplay; allow the next one to retry.
    presenceLastPayload = '';
    console.warn('[discord] setActivity failed:', e.message);
  }
}

function queuePresence(activity) {
  if (!presenceSdk()) return;
  presencePending = activity;
  presencePendingSet = true;
  if (presenceTimer) return;
  const wait = Math.max(0, PRESENCE_MIN_INTERVAL_MS - (Date.now() - presenceLastSentAt));
  if (wait === 0) {
    flushPresence();
    return;
  }
  presenceTimer = setTimeout(flushPresence, wait);
}

/**
 * Ask for the rich-presence scope, but degrade gracefully: if the app isn't
 * allowed to write presence, authorize again with only the scopes the game needs
 * so the Activity still loads (just without the profile card). Returns the OAuth
 * code plus whether presence ended up granted.
 */
async function authorizeWithPresence(discordSdk) {
  const args = {
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none'
  };

  // Fetching the user must NEVER hinge on the rich-presence scope. `identify`
  // and `applications.commands` are auto-granted for Activities and return
  // instantly, but `rpc.activities.write` needs explicit consent — and a
  // prompt:'none' authorize for a not-yet-consented scope can *hang* (not just
  // reject) in some Discord clients. Without a bound that stalls the whole
  // handshake and the user is never fetched. So race the presence attempt
  // against a short timeout, and on timeout OR rejection fall back to the
  // auto-granted scopes, which always succeed.
  try {
    const res = await Promise.race([
      discordSdk.commands.authorize({ ...args, scope: [...BASE_SCOPES, PRESENCE_SCOPE] }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('presence authorize timed out')), 3000)
      )
    ]);
    return { ...res, presence: true };
  } catch (err) {
    console.warn(
      `[discord] authorize with ${PRESENCE_SCOPE} unavailable (${err.message}) — continuing without rich presence`
    );
    const res = await discordSdk.commands.authorize({ ...args, scope: BASE_SCOPES });
    return { ...res, presence: false };
  }
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

  const { code, presence } = await authorizeWithPresence(discordSdk);
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

  const { access_token, session_token } = await tokenRes.json();
  console.info('[discord] token ok; authenticating…');
  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error('Discord authenticate command failed');
  }

  // Someone pressed "Ask to Join" on our profile card: Discord hands their client
  // the join secret we published in setActivity(). Fired in the *joining* user's
  // iframe, so the app can route them into the exact room instead of the default
  // voice-channel one. Subscribing may be refused without the presence scope —
  // never fatal.
  await subscribeQuietly(discordSdk, Events.ACTIVITY_JOIN, (data) => {
    console.info('[discord] ACTIVITY_JOIN', data?.secret ? '(secret received)' : '(no secret)');
    dispatch('discord-activity-join', { secret: data?.secret || null });
  });

  // Keeps the in-app player card able to show real Discord avatars for everyone
  // currently in the Activity.
  await subscribeQuietly(discordSdk, Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, (data) => {
    participants = Array.isArray(data?.participants) ? data.participants : [];
    dispatch('discord-participants', { participants });
  });
  try {
    const res = await discordSdk.commands.getActivityInstanceConnectedParticipants();
    participants = Array.isArray(res?.participants) ? res.participants : [];
  } catch (e) {
    console.warn('[discord] could not read connected participants:', e.message);
  }

  console.info('[discord] activity ready ✓', presence ? '(rich presence on)' : '(no rich presence)');
  document.documentElement.classList.add('platform-discord');

  return {
    sdk: discordSdk,
    auth,
    presence,
    sessionToken: session_token || null,
    instanceId: discordSdk.instanceId,
    channelId: discordSdk.channelId,
    guildId: discordSdk.guildId
  };
}

/** subscribe() that logs and swallows failures instead of aborting init. */
async function subscribeQuietly(discordSdk, event, handler) {
  try {
    await discordSdk.subscribe(event, handler);
    return true;
  } catch (e) {
    console.warn(`[discord] subscribe(${event}) failed:`, e.message);
    return false;
  }
}

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// Mark the embed context up front, before any await that could fail. The
// fit-to-embed layout and the "never show the web login gate here" rule must
// apply inside Discord even when the handshake below never completes.
if (inDiscordEmbed()) document.documentElement.classList.add('platform-discord');

window.DISCORD_ACTIVITY = {
  ready: null,
  // Are we inside a Discord Activity iframe at all? (Independent of `active`,
  // which only turns true once the SDK handshake succeeds.)
  embedded: inDiscordEmbed(),
  get user() {
    return window.DISCORD_ACTIVITY._session?.auth?.user ?? null;
  },
  get instanceId() {
    return window.DISCORD_ACTIVITY._session?.instanceId ?? null;
  },
  get active() {
    return Boolean(window.DISCORD_ACTIVITY._session);
  },
  get sessionToken() {
    return window.DISCORD_ACTIVITY._session?.sessionToken ?? null;
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

  // True when setActivity() is usable — the handshake succeeded AND the app was
  // granted rpc.activities.write. Callers use this to hide presence-only UI.
  get canSetActivity() {
    return Boolean(presenceSdk());
  },

  // Publish (or refresh) this player's Discord rich presence: the card other
  // members see when they click the player. Coalesced to respect Discord's
  // SET_ACTIVITY rate limit, so callers may fire it as often as they like.
  setActivity(activity) {
    queuePresence(activity);
  },

  // Wipe the presence card (back on the home screen, or presence turned off).
  clearActivity() {
    queuePresence(null);
  },

  // Discord's native invite sheet for the Activity's voice channel — the reliable
  // way to pull someone into this exact room.
  openInviteDialog() {
    const sdk = window.DISCORD_ACTIVITY._session?.sdk;
    if (sdk?.commands?.openInviteDialog) return sdk.commands.openInviteDialog();
    return null;
  },

  // Users connected to this Activity instance, kept fresh by the
  // ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE subscription.
  get participants() {
    return participants;
  },

  // Look up a connected participant by Discord user id (for real avatars in the
  // in-app player card).
  participant(userId) {
    if (!userId) return null;
    return participants.find((p) => p.id === String(userId)) || null;
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
