'use strict';

const { verifySession } = require('./_session');

/**
 * Authenticated progression: XP, level, daily streak and achievements.
 *
 * player_stats is keyed on `player`, a display name the client asserts. Renaming
 * on Discord therefore orphans a player's level, achievements and streak, and a
 * freed name can be picked up by someone else along with the profile behind it.
 * supabase/migration-score-integrity.sql added a discord_id column to fix that
 * and left step (b) — "ship the code that stamps it" — for later.
 *
 * Later never came for this table: record_progress() had no discord_id
 * parameter, so of 1080 player_stats rows, zero carried one. This endpoint is
 * that missing step. It calls the 7-argument overload, which only the
 * service-role key may reach, with the id taken from `sub` on the HMAC-signed
 * session token this server minted — never from the request body.
 *
 * NOT fail-closed, unlike /api/join-room, and the difference is deliberate. A
 * seat in a room is an identity claim, so an unproven one must be refused. XP is
 * a reward for a round already played: refusing it because the player is on the
 * Electron desktop build (no /api, no session token) would delete a working
 * feature to gain nothing. Those callers keep using the 6-argument RPC directly
 * and simply record no id, exactly as they do today. See recordPlay() in
 * src/modules/api.js for the fallback.
 */

// Bounds. record_progress clamps internally too; these keep obvious nonsense out
// of the round trip and out of the rate limiter's way.
const MAX_SECONDS = 86400;   // matches the RPC's own clamp
const MAX_XP = 5000;         // a round tops out far below this

const RATE_MAX = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // discord id -> { count, first }

function rateLimited(key) {
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [k, rec] of hits) if (now - rec.first > RATE_WINDOW_MS) hits.delete(k);
  }
  const rec = hits.get(key);
  if (!rec || now - rec.first > RATE_WINDOW_MS) {
    hits.set(key, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = String(req.headers.authorization || '');
  const session = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  if (rateLimited(String(session.sub))) {
    return res.status(429).json({ error: 'Too many submissions' });
  }

  const player = String(req.body?.player || '').trim();
  const seconds = Number(req.body?.seconds);
  const xp = Number(req.body?.xp);

  if (!player || player.length > 24) return res.status(400).json({ error: 'Bad player name' });
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS) {
    return res.status(400).json({ error: 'Bad seconds' });
  }
  if (!Number.isSafeInteger(xp) || xp < 0 || xp > MAX_XP) {
    return res.status(400).json({ error: 'Bad xp' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Progression is not configured' });

  try {
    const rpcRes = await fetch(`${url}/rest/v1/rpc/record_progress`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_player: player,
        p_seconds: seconds,
        p_multiplayer: !!req.body?.multiplayer,
        p_won: !!req.body?.won,
        p_xp: xp,
        p_perfect: !!req.body?.perfect,
        // The point of this endpoint. Taken from the signed session, so the
        // caller cannot claim to be anyone else.
        p_discord_id: String(session.sub)
      })
    });
    const text = await rpcRes.text();
    if (!rpcRes.ok) {
      console.error('record_progress failed:', rpcRes.status, text);
      return res.status(502).json({ error: 'Could not record progress' });
    }
    return res.status(200).json({ ok: true, progress: text ? JSON.parse(text) : null });
  } catch (err) {
    console.error('record-progress endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Could not record progress' });
  }
};
