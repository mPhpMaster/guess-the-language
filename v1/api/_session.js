'use strict';

const crypto = require('crypto');

function sessionSecret() {
  return process.env.APP_SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
}

// `extra` lets the token carry additional signed (unforgeable) claims — notably
// `adm: true` for admins. Because the whole payload is HMAC-signed, a client
// cannot flip these on by editing the token.
function signSession(discordUserId, extra = {}, lifetimeSeconds = 60 * 60 * 24 * 7) {
  const secret = sessionSecret();
  if (!secret || !discordUserId) return null;
  const payload = Buffer.from(JSON.stringify({
    ...extra,
    sub: String(discordUserId),
    exp: Math.floor(Date.now() / 1000) + lifetimeSeconds
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

// True when the given Discord username is configured as an admin. Set
// ADMIN_DISCORD_USERNAMES (comma-separated, case-insensitive) in the env to add
// more; `alhlack` is always included as the owner.
function isAdminUsername(username) {
  const uname = String(username || '').trim().toLowerCase();
  if (!uname) return false;
  const configured = String(process.env.ADMIN_DISCORD_USERNAMES || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const admins = new Set(['alhlack', ...configured]);
  return admins.has(uname);
}

function verifySession(token) {
  const secret = sessionSecret();
  if (!secret || !token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = { signSession, verifySession, isAdminUsername };
