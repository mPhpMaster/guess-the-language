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

// ---- Admin passcode (second factor on top of the signed `adm` claim) ----
// The expected value lives ONLY in the ADMIN_PASSCODE env var. There is no
// default and no fallback: when it is unset the unlock action fails closed.
const UNLOCK_TTL_SECONDS = 30 * 60;

function adminPasscodeConfigured() {
  return typeof process.env.ADMIN_PASSCODE === 'string' && process.env.ADMIN_PASSCODE.length > 0;
}

// Constant-time equality that leaks neither the content nor the LENGTH of the
// secret: both sides are first reduced to a fixed 32-byte HMAC digest (keyed
// with a random per-process key, so the digests are useless to an attacker),
// and only those equal-length buffers are compared with timingSafeEqual.
const COMPARE_KEY = crypto.randomBytes(32);

function safeEquals(a, b) {
  const da = crypto.createHmac('sha256', COMPARE_KEY).update(String(a), 'utf8').digest();
  const db = crypto.createHmac('sha256', COMPARE_KEY).update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(da, db);
}

// Returns true only when a passcode is configured AND matches. Never logs or
// echoes the value.
function checkAdminPasscode(candidate) {
  if (!adminPasscodeConfigured()) return false;
  if (typeof candidate !== 'string' || !candidate.length) return false;
  return safeEquals(candidate, process.env.ADMIN_PASSCODE);
}

// Short-lived "the human at the keyboard typed the passcode" token. It reuses
// the same HMAC scheme as the session token, with a distinct `unl` claim, and
// is bound to the same Discord user id as the session that requested it.
function signUnlock(discordUserId) {
  return signSession(discordUserId, { unl: true }, UNLOCK_TTL_SECONDS);
}

function verifyUnlock(token, discordUserId) {
  const data = verifySession(token);
  if (!data || data.unl !== true) return false;
  return String(data.sub) === String(discordUserId || '');
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

module.exports = {
  signSession,
  verifySession,
  isAdminUsername,
  adminPasscodeConfigured,
  checkAdminPasscode,
  signUnlock,
  verifyUnlock,
  UNLOCK_TTL_SECONDS
};
