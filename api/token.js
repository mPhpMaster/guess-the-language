import { isAdminUsername, signSession } from './_session.js';

/**
 * Exchange a Discord OAuth2 authorization code for an access token.
 * Called by the Embedded App SDK client during Activity authentication.
 * Requires DISCORD_CLIENT_SECRET (and client ID) in the Vercel env.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.body?.code;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
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
        code
      })
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        error: data.error || 'Token exchange failed',
        error_description: data.error_description
      });
    }

    // The profile lookup only exists to mint the optional session token. It must
    // stay best-effort: a hiccup here used to return 502, which aborted the whole
    // Activity handshake and left the game unplayable inside Discord.
    let sessionToken = null;
    try {
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      const user = await userRes.json();
      if (userRes.ok && user.id) {
        // Admin is decided here, server-side, from the real Discord username —
        // the resulting `adm` claim is signed so the client can't forge it.
        sessionToken = signSession(user.id, {
          adm: isAdminUsername(user.username),
          uname: user.username || null
        });
      } else {
        console.warn('Discord profile fetch failed; continuing without a session token');
      }
    } catch (err) {
      console.warn('Discord profile fetch error; continuing without a session token:', err.message);
    }

    return res.status(200).json({ access_token: data.access_token, session_token: sessionToken });
  } catch (err) {
    console.error('Discord token exchange error:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}
