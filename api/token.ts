import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdminUsername, signSession } from './_session.js';

interface TokenResponse {
    readonly access_token?: string;
    readonly error?: string;
    readonly error_description?: string;
}

interface DiscordUser {
    readonly id?: string;
    readonly username?: string;
}

/**
 * Exchange a Discord OAuth2 authorization code for an access token. Called by
 * the Embedded App SDK client during Activity authentication.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const body = (req.body ?? {}) as { code?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code) {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
    }

    const clientId = process.env['VITE_DISCORD_CLIENT_ID'] ?? process.env['DISCORD_CLIENT_ID'];
    const clientSecret = process.env['DISCORD_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
        res.status(500).json({ error: 'Discord OAuth is not configured' });
        return;
    }

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
            }),
        });
        const data = (await tokenRes.json()) as TokenResponse;

        if (!tokenRes.ok || !data.access_token) {
            res.status(tokenRes.status).json({
                error: data.error ?? 'Token exchange failed',
                error_description: data.error_description,
            });
            return;
        }

        // The profile lookup only exists to mint the optional session token, so it
        // stays best-effort: a hiccup here must not abort the Activity handshake.
        let sessionToken: string | null = null;
        try {
            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            const user = (await userRes.json()) as DiscordUser;
            if (userRes.ok && user.id) {
                // Admin is decided here, server-side, from the real Discord username —
                // the resulting `adm` claim is signed so the client can't forge it.
                sessionToken = signSession(user.id, {
                    adm: isAdminUsername(user.username),
                    uname: user.username ?? null,
                });
            } else {
                console.warn('Discord profile fetch failed; continuing without a session token');
            }
        } catch (err) {
            console.warn('Discord profile fetch error; continuing without a session token:', err);
        }

        res.status(200).json({ access_token: data.access_token, session_token: sessionToken });
    } catch (err) {
        console.error('Discord token exchange error:', err);
        res.status(500).json({ error: 'Token exchange failed' });
    }
}
