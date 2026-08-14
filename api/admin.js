'use strict';

const {
  verifySession,
  adminPasscodeConfigured,
  checkAdminPasscode,
  signUnlock,
  verifyUnlock,
  UNLOCK_TTL_SECONDS
} = require('./_session');

// ===== Admin API =====
// Every destructive capability the in-game admin panel exposes goes through here.
// Security model:
//   1. The caller must present a session token whose signed `adm` claim is true.
//      That claim is set server-side in /api/token from the real Discord username,
//      and the token is HMAC-signed, so it cannot be forged or self-granted.
//   2. Every *mutating* action additionally requires a short-lived unlock token,
//      which is only issued by the `unlock` action after the caller proves it
//      knows the ADMIN_PASSCODE. That makes the passcode a real second factor
//      rather than a client-side `if` anyone could skip.
//   3. Actual DB writes use the Supabase SERVICE ROLE key (never shipped to the
//      client) and go through service_role-only RPCs. anon can't reach them.

// Actions that change state. Read-only actions (whoami / reports / users /
// live / banned) keep the pre-existing `adm`-only gate.
const MUTATING_ACTIONS = new Set([
  'delete_score', 'ban', 'unban', 'reset_profile', 'make_host', 'kick', 'resolve_report'
]);

// ---- Brute-force guard for `unlock` ----------------------------------------
// Best effort only: serverless instances do not share memory, so an attacker
// spread across instances gets a few extra tries. It still turns an online
// guessing attack into something far slower than an unthrottled loop.
const UNLOCK_MAX_FAILURES = 5;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const UNLOCK_LOCKOUT_MS = 15 * 60 * 1000;
const unlockAttempts = new Map(); // key -> { fails, first, until }

function pruneUnlockAttempts(now) {
  if (unlockAttempts.size < 500) return;
  for (const [key, rec] of unlockAttempts) {
    if ((rec.until || 0) <= now && now - rec.first > UNLOCK_WINDOW_MS) unlockAttempts.delete(key);
  }
}

// Seconds the caller must wait, or 0 when it may try now.
function unlockCooldown(key) {
  const now = Date.now();
  const rec = unlockAttempts.get(key);
  if (!rec) return 0;
  if (rec.until && rec.until > now) return Math.ceil((rec.until - now) / 1000);
  if (rec.until && rec.until <= now) { unlockAttempts.delete(key); return 0; }
  if (now - rec.first > UNLOCK_WINDOW_MS) { unlockAttempts.delete(key); return 0; }
  return 0;
}

function noteUnlockFailure(key) {
  const now = Date.now();
  pruneUnlockAttempts(now);
  const rec = unlockAttempts.get(key);
  if (!rec || now - rec.first > UNLOCK_WINDOW_MS) {
    unlockAttempts.set(key, { fails: 1, first: now, until: 0 });
    return;
  }
  rec.fails += 1;
  if (rec.fails >= UNLOCK_MAX_FAILURES) {
    rec.until = now + UNLOCK_LOCKOUT_MS;
    rec.first = now;
    rec.fails = 0;
  }
}

function clearUnlockFailures(key) {
  unlockAttempts.delete(key);
}

// Room and player ids are UUIDs; reject anything else before it reaches an RPC.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sbConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function sb(cfg, path, opts = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((body && (body.message || body.error)) || `Supabase ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Call a service_role-only RPC.
function rpc(cfg, fn, args) {
  return sb(cfg, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = String(req.headers.authorization || '');
  const session = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  if (!session.adm) return res.status(403).json({ error: 'Not an admin' });

  const by = String(session.uname || session.sub || 'admin');
  const action = String(req.body?.action || '');

  // Second factor. Requires an already-verified admin session, so a non-admin
  // cannot even reach the passcode check.
  if (action === 'unlock') {
    if (!adminPasscodeConfigured()) {
      // Fail closed — never "no passcode configured, so let them in".
      return res.status(503).json({ error: 'Admin passcode is not configured', code: 'unlock_unconfigured' });
    }
    const key = String(session.sub || '');
    const wait = unlockCooldown(key);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: 'Too many attempts', code: 'unlock_locked', retryAfter: wait });
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!checkAdminPasscode(passcode)) {
      noteUnlockFailure(key);
      const after = unlockCooldown(key);
      if (after > 0) {
        res.setHeader('Retry-After', String(after));
        return res.status(429).json({ error: 'Too many attempts', code: 'unlock_locked', retryAfter: after });
      }
      // Deliberately identical for a wrong passcode, an empty one, or a
      // malformed body — nothing here distinguishes the failure modes.
      return res.status(401).json({ error: 'Unlock failed' });
    }
    clearUnlockFailures(key);
    const unlock = signUnlock(session.sub);
    if (!unlock) return res.status(500).json({ error: 'Admin API is not configured' });
    return res.status(200).json({ ok: true, unlock, expiresIn: UNLOCK_TTL_SECONDS });
  }

  // Every state-changing action needs a live unlock token bound to this admin.
  if (MUTATING_ACTIONS.has(action)) {
    const supplied = typeof req.body?.unlock === 'string' ? req.body.unlock : '';
    if (!verifyUnlock(supplied, session.sub)) {
      return res.status(401).json({ error: 'Admin unlock required', code: 'unlock_required' });
    }
  }

  const cfg = sbConfig();
  if (!cfg) return res.status(500).json({ error: 'Admin API is not configured' });

  try {
    switch (action) {
      case 'whoami':
        return res.status(200).json({ admin: true, sub: session.sub, username: session.uname || null });

      case 'reports': {
        // Open reports first, then recently resolved; attach the reported score.
        const reports = await sb(cfg,
          'leaderboard_reports?select=id,score_id,reporter_discord_id,reason,details,status,created_at,resolved_at,resolved_by' +
          '&order=status.asc,created_at.desc&limit=100');
        const ids = [...new Set((reports || []).map((r) => r.score_id).filter(Boolean))];
        let scoreById = {};
        if (ids.length) {
          const scores = await sb(cfg, `scores?select=id,player,score,mode,avatar,multiplayer&id=in.(${ids.join(',')})`);
          scoreById = Object.fromEntries((scores || []).map((s) => [s.id, s]));
        }
        return res.status(200).json({
          reports: (reports || []).map((r) => ({ ...r, score: scoreById[r.score_id] || null }))
        });
      }

      case 'resolve_report': {
        const id = Number(req.body?.id);
        const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad id' });
        await sb(cfg, `leaderboard_reports?id=eq.${id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, resolved_at: new Date().toISOString(), resolved_by: by })
        });
        return res.status(200).json({ ok: true });
      }

      case 'delete_score': {
        const id = Number(req.body?.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad id' });
        await rpc(cfg, 'admin_delete_score', { p_id: id, p_by: by });
        return res.status(200).json({ ok: true });
      }

      case 'ban': {
        const player = String(req.body?.player || '').trim();
        const reason = String(req.body?.reason || '').trim().slice(0, 200);
        if (!player) return res.status(400).json({ error: 'Bad player' });
        await rpc(cfg, 'admin_ban', { p_player: player, p_reason: reason, p_by: by });
        return res.status(200).json({ ok: true });
      }

      case 'unban': {
        const player = String(req.body?.player || '').trim();
        if (!player) return res.status(400).json({ error: 'Bad player' });
        await rpc(cfg, 'admin_unban', { p_player: player });
        return res.status(200).json({ ok: true });
      }

      case 'reset_profile': {
        const player = String(req.body?.player || '').trim();
        if (!player) return res.status(400).json({ error: 'Bad player' });
        await rpc(cfg, 'admin_reset_profile', { p_player: player });
        return res.status(200).json({ ok: true });
      }

      /* In-room moderation. The room RPCs can only authenticate "I am this room's
         host" (they match a client-supplied room_players.id), so an admin sitting
         in a room as an ordinary player cannot use them. These two go through the
         service-role key instead, which is the only path where the `adm` claim
         above has actually been verified. */
      case 'make_host': {
        const roomId = String(req.body?.roomId || '').trim();
        const targetPlayerId = String(req.body?.targetPlayerId || '').trim();
        if (!UUID_RE.test(roomId)) return res.status(400).json({ error: 'Bad roomId' });
        if (!UUID_RE.test(targetPlayerId)) return res.status(400).json({ error: 'Bad targetPlayerId' });
        const out = await rpc(cfg, 'admin_make_host', {
          p_room_id: roomId, p_target_player_id: targetPlayerId, p_by: by
        });
        return res.status(200).json({ ok: true, result: out || null });
      }

      case 'kick': {
        const roomId = String(req.body?.roomId || '').trim();
        const targetPlayerId = String(req.body?.targetPlayerId || '').trim();
        if (!UUID_RE.test(roomId)) return res.status(400).json({ error: 'Bad roomId' });
        if (!UUID_RE.test(targetPlayerId)) return res.status(400).json({ error: 'Bad targetPlayerId' });
        const out = await rpc(cfg, 'admin_kick_player', {
          p_room_id: roomId, p_target_player_id: targetPlayerId, p_by: by
        });
        return res.status(200).json({ ok: true, result: out || null });
      }

      case 'banned': {
        const rows = await sb(cfg, 'banned_players?select=player,reason,banned_by,created_at&order=created_at.desc&limit=200');
        return res.status(200).json({ banned: rows || [] });
      }

      case 'users': {
        const search = String(req.body?.search || '').trim();
        const filter = search ? `&player=ilike.*${encodeURIComponent(search)}*` : '';
        const rows = await sb(cfg,
          'player_stats?select=player,level,xp,games,mp_games,wins,day_streak,perfect_games,last_seen' +
          `&order=last_seen.desc.nullslast&limit=200${filter}`);
        const banned = await sb(cfg, 'banned_players?select=player');
        const bannedSet = new Set((banned || []).map((b) => b.player));
        return res.status(200).json({
          users: (rows || []).map((u) => ({ ...u, banned: bannedSet.has(String(u.player).trim().toLowerCase()) }))
        });
      }

      case 'live': {
        const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const rows = await sb(cfg,
          'presence?select=player,discord_id,guild_id,channel_id,mode,activity,platform,updated_at' +
          `&updated_at=gte.${since}&order=updated_at.desc&limit=200`);
        return res.status(200).json({ live: rows || [] });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('admin action failed:', action, err && err.message);
    return res.status(err.status && err.status < 500 ? err.status : 500).json({ error: 'Admin action failed' });
  }
};
