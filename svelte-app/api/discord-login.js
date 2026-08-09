import { isAdminUsername, signSession } from './_session.js';

/**
 * "Login with Discord" for the WEB build (standard OAuth2 authorization-code
 * flow, distinct from the Embedded App SDK flow used inside a Discord Activity).
 *
 * The browser sends the { code, redirect_uri } it got back from Discord; this
 * endpoint exchanges them for an access token (server-side, using the client
 * secret), fetches the user's identity, and returns only the public profile —
 * the access token never reaches the client.
 *
 * Requires DISCORD_CLIENT_SECRET (and client id) in the Vercel env, and the
 * redirect_uri must be registered under the app's OAuth2 -> Redirects.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.body?.code;
  const redirectUri = req.body?.redirect_uri;
  if (!code || typeof code !== 'string' || !redirectUri || typeof redirectUri !== 'string') {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  const clientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Discord OAuth is not configured' });
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
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        error: tokenData.error_description || tokenData.error || 'Token exchange failed'
      });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok) {
      return res.status(userRes.status).json({ error: 'Failed to fetch Discord profile' });
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      session_token: signSession(user.id, {
        adm: isAdminUsername(user.username),
        uname: user.username || null
      })
    });
  } catch (err) {
    console.error('Discord login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
