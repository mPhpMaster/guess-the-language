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
// Normally the expected value is the ADMIN_PASSCODE env var. When that is unset
// the passcode falls back to TODAY'S DATE as DDMMYYYY (e.g. 14082026).
//
// That fallback is deliberately weak and is a convenience, not a security
// control: anyone who knows the scheme can derive it. It does not open the panel
// to the public — the FIRST factor still applies, an HMAC-signed `adm` claim set
// server-side from the real Discord username, which cannot be forged. But it does
// give up most of what the second factor was for (someone using an already
// signed-in session). Set ADMIN_PASSCODE to get real second-factor protection.
const UNLOCK_TTL_SECONDS = 30 * 60;

function adminPasscodeConfigured() {
  return normalizePasscode(process.env.ADMIN_PASSCODE).length > 0;
}

// CLI pipes (`echo ... | vercel env add`) often include a trailing newline, and
// PowerShell's `$$` is the current PID unless the value is single-quoted. Trim
// so those accidents cannot make a typed passcode miss forever.
function normalizePasscode(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

// The date-based fallback, as DDMMYYYY. The server runs on UTC while the owner is
// in Asia/Riyadh (UTC+3), so both dates are accepted — otherwise "today's date"
// would stop working three hours before local midnight every night.
const FALLBACK_TZ_OFFSETS_MINUTES = [0, 180]; // UTC, Asia/Riyadh

function fallbackPasscodes(now = Date.now()) {
  const out = new Set();
  for (const offset of FALLBACK_TZ_OFFSETS_MINUTES) {
    const d = new Date(now + offset * 60000);
    out.add(
      String(d.getUTCDate()).padStart(2, '0') +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCFullYear())
    );
  }
  return [...out];
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

// Never logs or echoes the value. Falls back to the date passcode when
// ADMIN_PASSCODE is unset (see the note above).
function checkAdminPasscode(candidate) {
  const got = normalizePasscode(candidate);
  if (!got) return false;
  if (adminPasscodeConfigured()) {
    return safeEquals(got, normalizePasscode(process.env.ADMIN_PASSCODE));
  }
  // Every candidate is compared, with no early exit, so the time taken does not
  // reveal which of the accepted dates matched.
  let ok = false;
  for (const expected of fallbackPasscodes()) {
    if (safeEquals(got, expected)) ok = true;
  }
  return ok;
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
