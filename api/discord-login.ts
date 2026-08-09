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
    readonly global_name?: string | null;
    readonly avatar?: string | null;
}

/**
 * "Login with Discord" for the WEB build (standard OAuth2 authorization-code
 * flow, distinct from the Embedded App SDK flow used inside an Activity).
 * The access token never reaches the client — only the public profile does.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const body = (req.body ?? {}) as { code?: unknown; redirect_uri?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
    if (!code || !redirectUri) {
        res.status(400).json({ error: 'Missing code or redirect_uri' });
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
                redirect_uri: redirectUri,
            }),
        });
        const tokenData = (await tokenRes.json()) as TokenResponse;
        if (!tokenRes.ok || !tokenData.access_token) {
            res.status(tokenRes.status).json({
                error: tokenData.error_description ?? tokenData.error ?? 'Token exchange failed',
            });
            return;
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const user = (await userRes.json()) as DiscordUser;
        if (!userRes.ok || !user.id) {
            res.status(userRes.status).json({ error: 'Failed to fetch Discord profile' });
            return;
        }

        res.status(200).json({
            id: user.id,
            username: user.username,
            global_name: user.global_name,
            avatar: user.avatar,
            session_token: signSession(user.id, {
                adm: isAdminUsername(user.username),
                uname: user.username ?? null,
            }),
        });
    } catch (err) {
        console.error('Discord login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}
