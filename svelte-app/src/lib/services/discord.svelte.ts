import type { DiscordSDK } from '@discord/embedded-app-sdk';
import { sanitizeName } from '$lib/game/names';

/**
 * Discord Activity integration.
 *
 * Two identities can be in play: the embedded Activity (SDK handshake) and a
 * plain-web Discord login persisted to localStorage. `discordProfile()` resolves
 * whichever applies so the rest of the app never has to branch on it.
 */

export interface DiscordUser {
  id: string;
  username?: string;
  global_name?: string;
  avatar?: string | null;
}

export interface DiscordProfile {
  id: string;
  name: string;
  avatar: string | null;
  sessionToken?: string | null;
}

export interface Participant {
  id: string;
  username?: string;
  global_name?: string;
  avatar?: string | null;
}

const clientId: string | undefined =
  (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) || window.DISCORD_CONFIG?.clientId;

/**
 * `rpc.activities.write` is what enables setActivity() — the "Playing … / Round
 * 3 of 10" card on a member's profile. Requested as an extra on top of the
 * scopes the game needs, so a rejection must never break the handshake.
 */
const BASE_SCOPES = ['identify', 'applications.commands'];
const PRESENCE_SCOPE = 'rpc.activities.write';

/** A cold start reached through the Discord proxy can take several seconds. */
const TOKEN_TIMEOUT_MS = 12_000;

/**
 * True when the page runs inside a Discord Activity iframe — decided from the
 * URL alone, so it stays true even if the handshake later fails. The app needs
 * this to know it must NOT fall back to the web login flow: a top-level OAuth
 * redirect cannot work inside Discord's sandboxed iframe, so treating a failed
 * handshake as "signed-out web user" would make the game unplayable.
 */
export function inDiscordEmbed(): boolean {
  if (location.pathname.startsWith('/.proxy')) return true;
  const params = new URLSearchParams(location.search);
  return params.has('frame_id') || params.has('instance_id');
}

/** Discord proxies API calls through /.proxy when URL mapping is configured. */
export function apiPrefix(): string {
  return inDiscordEmbed() ? '/.proxy' : '';
}

/**
 * Route Supabase through the "/supabase" URL Mapping BEFORE anything can make a
 * request: Discord's iframe CSP has no supabase.co in connect-src, so an
 * unproxied call is blocked outright.
 *
 * Ordering matters: this must complete before the app issues any Supabase
 * request. It used to run after `sdk.ready()`, which meant everything the app
 * did during boot went out unproxied and failed. `main.ts` therefore awaits
 * `ready` before mounting when embedded. Depends on window.SUPABASE_CONFIG, so
 * the config script must load before the bundle.
 */
async function patchSupabaseMapping(
  patchUrlMappings: (m: { prefix: string; target: string }[]) => void
): Promise<void> {
  try {
    const supaUrl = window.SUPABASE_CONFIG?.url;
    if (!supaUrl) {
      console.warn('[discord] SUPABASE_CONFIG missing at patch time — check script order');
      return;
    }
    patchUrlMappings([{ prefix: '/supabase', target: new URL(supaUrl).host }]);
  } catch (e) {
    console.warn('[discord] Supabase proxy mapping failed:', e);
  }
}

// ---------- session ----------

interface Session {
  sdk: DiscordSDK;
  auth: { user: DiscordUser; access_token?: string };
  instanceId: string | null;
  guildId: string | null;
  channelId: string | null;
  sessionToken: string | null;
  presence: boolean;
}

let session: Session | null = null;
let setupStep = 'init';

/** Connected participants, kept fresh by the participants subscription. */
const participants = $state<Participant[]>([]);

class DiscordState {
  /** True once the SDK handshake has succeeded. */
  active = $state(false);
  /** True inside a Discord iframe regardless of handshake outcome. */
  embedded = $state(inDiscordEmbed());
  user = $state<DiscordUser | null>(null);
  /** Non-null when the handshake failed — the UI surfaces this. */
  error = $state<string | null>(null);

  get instanceId(): string | null {
    return session?.instanceId ?? null;
  }
  get guildId(): string | null {
    return session?.guildId ?? null;
  }
  get channelId(): string | null {
    return session?.channelId ?? null;
  }
  get sessionToken(): string | null {
    return session?.sessionToken ?? null;
  }
  /** setActivity() is only usable when rpc.activities.write was granted. */
  get canSetActivity(): boolean {
    return !!session?.presence;
  }
  get participants(): Participant[] {
    return participants;
  }
}

export const discord = new DiscordState();

export function participantById(userId: string | null | undefined): Participant | null {
  if (!userId) return null;
  return participants.find((p) => p.id === String(userId)) ?? null;
}

// ---------- handshake ----------

/**
 * CRITICAL: the SDK is single-flight for authorize() — a second call while the
 * first is pending throws "Already authing". An earlier version raced the
 * presence authorize against a 3s timeout and fired a second authorize on
 * timeout; the timeout doesn't cancel the first, so nearly every user hit
 * "Already authing" and the Activity could not read their identity.
 *
 * Exactly one authorize is in flight at a time; the fallback runs only after the
 * first has actually rejected.
 */
async function authorizeWithPresence(sdk: DiscordSDK): Promise<{ code: string; presence: boolean }> {
  const args = {
    client_id: clientId!,
    response_type: 'code' as const,
    state: '',
    prompt: 'none' as const
  };
  try {
    const res = await sdk.commands.authorize({ ...args, scope: [...BASE_SCOPES, PRESENCE_SCOPE] as never });
    return { code: res.code, presence: true };
  } catch (err) {
    console.warn(`[discord] ${PRESENCE_SCOPE} unavailable (${(err as Error)?.message}) — retrying with base scopes`);
    const res = await sdk.commands.authorize({ ...args, scope: BASE_SCOPES as never });
    return { code: res.code, presence: false };
  }
}

/**
 * Track who is connected to this Activity instance, so room players can be
 * matched to real Discord avatars. A refused subscription is never fatal.
 */
async function subscribeParticipants(sdk: DiscordSDK): Promise<void> {
  try {
    const { Events } = await import('@discord/embedded-app-sdk');
    await sdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, (event) => {
      participants.splice(0, participants.length, ...((event?.participants ?? []) as Participant[]));
    });
  } catch {
    /* refused without the presence scope — never fatal */
  }
}

async function exchangeToken(code: string): Promise<{ access_token: string; session_token?: string }> {
  // Bound the exchange so a request that never returns can't hang the Activity.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${apiPrefix()}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    });
  } catch (err) {
    throw new Error(
      (err as Error).name === 'AbortError'
        ? 'Token exchange timed out — is /api/token reachable through the Discord proxy?'
        : `Token exchange request failed: ${(err as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
    throw new Error(body.error_description || body.error || `Token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string; session_token?: string };
  if (!data.access_token) throw new Error('Token exchange returned no access_token');
  return { access_token: data.access_token, session_token: data.session_token };
}

async function setup(): Promise<Session | null> {
  if (!clientId) return null; // plain web app

  // The SDK is only meaningful inside the Activity iframe, so it is imported on
  // demand — the web and Electron builds never download it.
  const { DiscordSDK: SDK, patchUrlMappings } = await import('@discord/embedded-app-sdk');

  // Route Supabase through the "/supabase" URL Mapping BEFORE the handshake:
  // Discord's iframe CSP has no supabase.co in connect-src, so an unproxied call
  // is blocked outright. This used to run after sdk.ready(), which meant every
  // request the app made during boot went out unproxied and failed.
  await patchSupabaseMapping(patchUrlMappings);

  setupStep = 'sdk-ready';
  const sdk = new SDK(clientId);
  await sdk.ready();

  setupStep = 'authorize';
  const { code, presence } = await authorizeWithPresence(sdk);
  if (!code) throw new Error('Discord authorize returned no code (user declined the prompt)');

  setupStep = 'token-exchange';
  const { access_token, session_token } = await exchangeToken(code);

  setupStep = 'authenticate';
  const auth = await sdk.commands.authenticate({ access_token });
  if (!auth) throw new Error('Discord authenticate command failed (no auth response)');
  // Reading the player's identity is the whole point of the handshake — a
  // missing user is a hard failure worth logging, not a silent web fallback.
  if (!auth.user?.id) throw new Error('Discord authenticate succeeded but returned no user identity');

  setupStep = 'ready';

  await subscribeParticipants(sdk);

  return {
    sdk,
    auth: auth as unknown as Session['auth'],
    instanceId: sdk.instanceId ?? null,
    guildId: sdk.guildId ?? null,
    channelId: sdk.channelId ?? null,
    sessionToken: session_token ?? null,
    presence
  };
}

/** Resolves once the handshake has settled (successfully or not). */
async function bootstrap(): Promise<void> {
  try {
    session = await setup();
    if (session) {
      discord.active = true;
      discord.user = session.auth.user;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Discord Activity setup skipped:', message);
    // Only worth logging inside a real Discord iframe — on the plain web build
    // the SDK never handshakes and a failure here is expected noise.
    if (inDiscordEmbed()) {
      discord.error = message;
      window.GTL_LOG_ERROR?.(message, {
        source: 'discord-setup',
        level: 'error',
        stack: err instanceof Error ? err.stack : undefined,
        context: { step: setupStep, embedded: true, clientId: clientId ?? null }
      });
    }
    session = null;
  }
}

/**
 * Resolves once the handshake has settled (successfully or not).
 *
 * Inside the Activity the caller MUST await this before issuing any Supabase
 * request, because the URL mapping that makes those requests reachable is
 * installed during bootstrap. Outside Discord it resolves immediately.
 */
export const ready: Promise<void> = inDiscordEmbed() ? bootstrap() : Promise.resolve();

// ---------- identity ----------

const LINKED_KEY = 'gtl_discord_user';

/** Web (non-embedded) sign-in, persisted from the OAuth callback. */
export function linkedDiscordUser(): DiscordProfile | null {
  try {
    return JSON.parse(localStorage.getItem(LINKED_KEY) ?? 'null') as DiscordProfile | null;
  } catch {
    return null;
  }
}

export function isDiscordLinked(): boolean {
  return discord.active || !!linkedDiscordUser();
}

export function discordProfile(): DiscordProfile | null {
  if (discord.active && discord.user) {
    const u = discord.user;
    return { id: u.id, name: sanitizeName(u.global_name || u.username || ''), avatar: u.avatar ?? null };
  }
  return linkedDiscordUser();
}

export function appSessionToken(): string | null {
  return discord.active ? discord.sessionToken : (linkedDiscordUser()?.sessionToken ?? null);
}

export function discordAvatarUrl(user: { id: string; avatar?: string | null } | null, size = 64): string | null {
  if (user?.id && user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
  }
  return null;
}

// ---------- commands ----------

/** Plain window.open is blocked by Discord's sandbox — route through the SDK. */
export function openExternal(url: string): void {
  if (session?.sdk?.commands?.openExternalLink) {
    void session.sdk.commands.openExternalLink({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Discord's native invite sheet for the Activity's voice channel. */
export function openInviteDialog(): Promise<unknown> | null {
  return session?.sdk?.commands?.openInviteDialog?.() ?? null;
}

/** Discord's share sheet, so a challenge can go straight to a friend's DM. */
export function shareLink(message: string, payload: string | null): Promise<unknown> | null {
  const commands = session?.sdk?.commands as
    | { shareLink?: (a: { message: string; custom_id?: string }) => Promise<unknown> }
    | undefined;
  if (!commands?.shareLink) return null;
  const args: { message: string; custom_id?: string } = { message: String(message).slice(0, 1000) };
  if (payload) args.custom_id = String(payload).slice(0, 64);
  return commands.shareLink(args);
}
