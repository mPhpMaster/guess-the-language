import crypto from 'node:crypto';

/* ============================================================
   HMAC-signed session tokens. The payload carries unforgeable
   claims — notably `adm: true` for admins — because the client
   cannot re-sign an edited payload.
   ============================================================ */

export interface SessionClaims {
    readonly sub: string;
    readonly exp: number;
    readonly adm?: boolean;
    readonly uname?: string | null;
}

const DEFAULT_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): string {
    return process.env['APP_SESSION_SECRET'] ?? process.env['DISCORD_CLIENT_SECRET'] ?? '';
}

export function signSession(
    discordUserId: string,
    extra: Readonly<Record<string, unknown>> = {},
    lifetimeSeconds: number = DEFAULT_LIFETIME_SECONDS,
): string | null {
    const secret = sessionSecret();
    if (!secret || !discordUserId) return null;
    const payload = Buffer.from(
        JSON.stringify({
            ...extra,
            sub: String(discordUserId),
            exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
        }),
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

/**
 * True when the Discord username is configured as an admin. Set
 * ADMIN_DISCORD_USERNAMES (comma-separated, case-insensitive) to add more;
 * `alhlack` is always included as the owner.
 */
export function isAdminUsername(username: string | null | undefined): boolean {
    const name = String(username ?? '').trim().toLowerCase();
    if (!name) return false;
    const configured = String(process.env['ADMIN_DISCORD_USERNAMES'] ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
    return new Set(['alhlack', ...configured]).has(name);
}

export function verifySession(token: string | null | undefined): SessionClaims | null {
    const secret = sessionSecret();
    if (!secret || !token) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = crypto.createHmac('sha256', secret).update(payload).digest();
    let actual: Buffer;
    try {
        actual = Buffer.from(signature, 'base64url');
    } catch {
        return null;
    }
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as
            | Partial<SessionClaims>
            | null;
        if (!data?.sub || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return null;
        return data as SessionClaims;
    } catch {
        return null;
    }
}

/** Read a `Bearer <token>` authorization header. */
export function bearerToken(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
    return value.startsWith('Bearer ') ? value.slice(7) : '';
}
