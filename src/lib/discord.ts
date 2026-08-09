import { DiscordSDK, Events, patchUrlMappings } from '@discord/embedded-app-sdk';
import { createSignal } from 'solid-js';
import { isDiscordEmbed } from './platform';
import { logError } from './errorLog';

/* ============================================================
   Discord Activity integration (Embedded App SDK).
   ============================================================ */

export interface DiscordUser {
    readonly id: string;
    readonly username: string;
    readonly global_name?: string | null;
    readonly avatar?: string | null;
}

export interface ActivityParticipant {
    readonly id: string;
    readonly username?: string;
    readonly avatar?: string | null;
}

export interface PresenceActivity {
    type: number;
    instance: boolean;
    details?: string;
    state?: string;
    timestamps?: { start: number };
    assets?: { large_image: string; large_text: string };
    party?: { id: string; size: [number, number] };
    secrets?: { join: string };
}

export interface ShareLinkResult {
    readonly didSendMessage?: boolean;
    readonly didCopyLink?: boolean;
}

interface ActivitySession {
    readonly sdk: DiscordSDK;
    readonly user: DiscordUser;
    readonly presence: boolean;
    readonly sessionToken: string | null;
    readonly instanceId: string | null;
    readonly channelId: string | null;
    readonly guildId: string | null;
    readonly customId: string | null;
}

const BASE_SCOPES = ['identify', 'applications.commands'] as const;
const PRESENCE_SCOPE = 'rpc.activities.write';
const PRESENCE_MIN_INTERVAL_MS = 5000;
const TOKEN_TIMEOUT_MS = 12_000;

const clientId: string =
    (import.meta.env['VITE_DISCORD_CLIENT_ID'] as string | undefined) ??
    window.DISCORD_CONFIG?.clientId ??
    '';

/**
 * Route Supabase (REST + realtime WebSocket) through the Activity proxy.
 *
 * This MUST run at module load, not after the SDK handshake. Discord's iframe
 * CSP has no `supabase.co` in `connect-src`, and the app starts querying
 * (heartbeat, leaderboard, error log) the moment it mounts — long before
 * `sdk.ready()` resolves. Patching later left every early request blocked,
 * including the error log itself, so the failure reported nothing at all.
 *
 * `patchUrlMappings` is standalone and does not need a ready SDK. It requires a
 * matching URL Mapping in the Developer Portal: "/supabase" -> Supabase host.
 */
if (isDiscordEmbed()) {
    try {
        const supabaseUrl = window.SUPABASE_CONFIG?.url;
        if (supabaseUrl) {
            patchUrlMappings([{ prefix: '/supabase', target: new URL(supabaseUrl).host }]);
        }
    } catch (err) {
        console.warn('[discord] Supabase proxy mapping failed:', err);
    }
}

let session: ActivitySession | null = null;

const [participants, setParticipants] = createSignal<readonly ActivityParticipant[]>([]);
const [sessionReady, setSessionReady] = createSignal(false);

export { participants, sessionReady };

type JoinHandler = (secret: string | null) => void;
const joinHandlers = new Set<JoinHandler>();

export function onActivityJoin(handler: JoinHandler): void {
    joinHandlers.add(handler);
}

/* ---------------- Rich presence (rate-limit coalesced) ---------------- */

let presenceLastSentAt = 0;
let presenceLastPayload = '';
let presencePending: PresenceActivity | null = null;
let presencePendingSet = false;
let presenceTimer: ReturnType<typeof setTimeout> | null = null;

function presenceSdk(): DiscordSDK | null {
    if (!session || !session.presence) return null;
    return session.sdk;
}

async function flushPresence(): Promise<void> {
    presenceTimer = null;
    const sdk = presenceSdk();
    if (!sdk || !presencePendingSet) return;

    const activity = presencePending;
    presencePendingSet = false;
    presencePending = null;

    const key = JSON.stringify(activity);
    if (key === presenceLastPayload) return;
    presenceLastPayload = key;
    presenceLastSentAt = Date.now();
    try {
        await sdk.commands.setActivity({
            activity: activity as unknown as Parameters<
                DiscordSDK['commands']['setActivity']
            >[0]['activity'],
        });
    } catch (err) {
        // A rejected update must not break gameplay; allow the next one to retry.
        presenceLastPayload = '';
        console.warn('[discord] setActivity failed:', err);
    }
}

function queuePresence(activity: PresenceActivity | null): void {
    if (!presenceSdk()) return;
    presencePending = activity;
    presencePendingSet = true;
    if (presenceTimer) return;
    const wait = Math.max(0, PRESENCE_MIN_INTERVAL_MS - (Date.now() - presenceLastSentAt));
    if (wait === 0) {
        void flushPresence();
        return;
    }
    presenceTimer = setTimeout(() => void flushPresence(), wait);
}

/* ---------------- Handshake ---------------- */

interface AuthorizeOutcome {
    readonly code: string;
    readonly presence: boolean;
}

/**
 * Ask for the rich-presence scope, degrading gracefully when it is refused.
 *
 * CRITICAL: the Discord SDK is single-flight for authorize() — a second
 * authorize() while the first is still pending throws "Already authing". So this
 * makes exactly ONE call at a time: try with the presence scope, and only if it
 * REJECTS (already settled — safe) fall back to a sequential base-scope call.
 */
async function authorizeWithPresence(sdk: DiscordSDK): Promise<AuthorizeOutcome> {
    const args = {
        client_id: clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
    } as const;

    try {
        const res = await sdk.commands.authorize({
            ...args,
            scope: [...BASE_SCOPES, PRESENCE_SCOPE],
        } as unknown as Parameters<DiscordSDK['commands']['authorize']>[0]);
        return { code: res.code, presence: true };
    } catch (err) {
        console.warn(`[discord] ${PRESENCE_SCOPE} unavailable (${String(err)}) — base scopes`);
        const res = await sdk.commands.authorize({
            ...args,
            scope: [...BASE_SCOPES],
        } as unknown as Parameters<DiscordSDK['commands']['authorize']>[0]);
        return { code: res.code, presence: false };
    }
}

/** Records how far the handshake got, so a failure names the exact stage. */
let setupStep = 'init';

async function subscribeQuietly(
    sdk: DiscordSDK,
    event: Parameters<DiscordSDK['subscribe']>[0],
    handler: (payload: unknown) => void,
): Promise<void> {
    try {
        await sdk.subscribe(event, handler as never);
    } catch (err) {
        console.warn(`[discord] subscribe(${String(event)}) failed:`, err);
    }
}

function readParticipants(payload: unknown): readonly ActivityParticipant[] {
    if (typeof payload !== 'object' || payload === null) return [];
    const list = (payload as { participants?: unknown }).participants;
    return Array.isArray(list) ? (list as readonly ActivityParticipant[]) : [];
}

async function setupActivity(): Promise<ActivitySession | null> {
    if (!clientId) {
        console.info('[discord] no clientId configured — running as a plain web app');
        return null;
    }

    setupStep = 'sdk-ready';
    const sdk = new DiscordSDK(clientId);
    await sdk.ready();
    setupStep = 'authorize';

    const { code, presence } = await authorizeWithPresence(sdk);
    if (!code) throw new Error('Discord authorize returned no code');

    setupStep = 'token-exchange';
    const prefix = window.location.pathname.startsWith('/.proxy') ? '/.proxy' : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
    let tokenRes: Response;
    try {
        tokenRes = await fetch(`${prefix}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            signal: controller.signal,
        });
    } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        throw new Error(
            aborted
                ? 'Token exchange timed out — is /api/token reachable through the Discord proxy?'
                : `Token exchange request failed: ${String(err)}`,
        );
    } finally {
        clearTimeout(timer);
    }

    if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);
    const payload = (await tokenRes.json()) as {
        access_token?: string;
        session_token?: string;
    };
    if (!payload.access_token) throw new Error('Token exchange returned no access_token');

    setupStep = 'authenticate';
    const auth = await sdk.commands.authenticate({ access_token: payload.access_token });
    if (!auth?.user?.id) {
        throw new Error('Discord authenticate returned no user identity');
    }
    setupStep = 'ready';

    await subscribeQuietly(sdk, Events.ACTIVITY_JOIN, (data) => {
        const secret =
            typeof data === 'object' && data !== null && 'secret' in data
                ? String((data as { secret: unknown }).secret ?? '')
                : '';
        for (const handler of joinHandlers) handler(secret || null);
    });

    await subscribeQuietly(sdk, Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, (data) => {
        setParticipants(readParticipants(data));
    });

    try {
        setParticipants(readParticipants(await sdk.commands.getActivityInstanceConnectedParticipants()));
    } catch (err) {
        console.warn('[discord] could not read connected participants:', err);
    }

    document.documentElement.classList.add('platform-discord');

    return {
        sdk,
        user: auth.user as DiscordUser,
        presence,
        sessionToken: payload.session_token ?? null,
        instanceId: sdk.instanceId,
        channelId: sdk.channelId,
        guildId: sdk.guildId,
        customId: (sdk as unknown as { customId?: string | null }).customId ?? null,
    };
}

/** Resolves once the handshake settles (successfully or not). */
export const activityReady: Promise<boolean> = (async () => {
    if (isDiscordEmbed()) document.documentElement.classList.add('platform-discord');
    try {
        session = await setupActivity();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('Discord Activity setup skipped:', message);
        // Only worth logging when actually inside a Discord iframe — on the plain web
        // build the handshake never runs and a failure here is expected noise.
        if (isDiscordEmbed()) {
            logError(message, {
                source: 'discord-setup',
                stack: err instanceof Error ? err.stack : undefined,
                context: { step: setupStep, clientId: clientId || null },
            });
        }
        session = null;
    }
    setSessionReady(true);
    return session !== null;
})();

/* ---------------- Public surface ---------------- */

export const discordActivity = {
    /** True once the SDK handshake has succeeded. */
    get active(): boolean {
        return session !== null;
    },
    get embedded(): boolean {
        return isDiscordEmbed();
    },
    get user(): DiscordUser | null {
        return session?.user ?? null;
    },
    get instanceId(): string | null {
        return session?.instanceId ?? null;
    },
    get channelId(): string | null {
        return session?.channelId ?? null;
    },
    get guildId(): string | null {
        return session?.guildId ?? null;
    },
    get sessionToken(): string | null {
        return session?.sessionToken ?? null;
    },
    /** custom_id carried in by a challenge deep link (null when launched normally). */
    get customId(): string | null {
        return session?.customId ?? null;
    },
    /** True when setActivity() is usable (handshake ok AND presence scope granted). */
    get canSetActivity(): boolean {
        return presenceSdk() !== null;
    },

    setActivity(activity: PresenceActivity): void {
        queuePresence(activity);
    },
    clearActivity(): void {
        queuePresence(null);
    },

    openExternal(url: string): void {
        const sdk = session?.sdk;
        if (!sdk) return;
        void sdk.commands.openExternalLink({ url }).catch((err: unknown) => {
            console.warn('[discord] openExternalLink:', err);
        });
    },

    async shareLink(message: string, payload: string | null): Promise<ShareLinkResult | null> {
        const sdk = session?.sdk;
        if (!sdk) return null;
        const args: { message: string; custom_id?: string } = {
            message: message.slice(0, 1000),
        };
        if (payload) args.custom_id = payload.slice(0, 64);
        const result = (await sdk.commands.shareLink(args)) as ShareLinkResult;
        return result;
    },

    async openInviteDialog(): Promise<void> {
        const sdk = session?.sdk;
        if (!sdk) throw new Error('Discord SDK unavailable');
        await sdk.commands.openInviteDialog();
    },

    participant(userId: string | null): ActivityParticipant | null {
        if (!userId) return null;
        return participants().find((p) => p.id === String(userId)) ?? null;
    },
} as const;
