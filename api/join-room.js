'use strict';

const { verifySession } = require('./_session');

/**
 * Authenticated seat allocation for a Discord Activity room.
 *
 * Until now the client called the join_discord_room RPC directly with the public
 * anon key, passing its own Discord user id as a plain parameter. The RPC's
 * rejoin path looks an existing seat up BY that id and hands the caller back the
 * seat — and, since the seat-token migration, that seat's credential:
 *
 *     select id into v_player_id from room_players
 *     where room_id = v_room.id and discord_user_id = v_discord_id;
 *     if v_player_id is not null then return ... _issue_player_token(v_player_id);
 *
 * Both inputs it needs were readable with the same public key —
 * rooms.discord_instance_id and room_players.discord_user_id are ordinary
 * columns granted to `anon` — so anyone on the internet could list a room, read a
 * player's Discord id, replay the pair back and receive that player's seat and
 * token. If the victim was the host, the room went with it. Verified end to end
 * against production before this was written.
 *
 * The fix is that the Discord id is no longer something the caller asserts. It
 * comes from `sub` on the HMAC-signed session token this server minted in
 * /api/token from the real Discord profile, so it cannot be chosen. The RPC is
 * revoked from anon and reached only through the service-role key here.
 *
 * Fail closed: no valid session, no seat. A player whose /api/token profile
 * lookup failed has no proof of identity, and there is no safe way to seat them
 * — allowing an unproven join is exactly the hole being closed. /api/token now
 * retries that lookup once so this stays rare.
 */

// Mirrors the modes the client can pick; the RPC stores whatever it is given.
const MODES = new Set([
  'languages', 'cybersecurity', 'devops', 'network', 'gamedev', 'algorithms', 'all'
]);

// Best-effort throttle, same caveat as /api/submit-score: serverless instances
// do not share memory, so a caller spread across instances gets more attempts.
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
    return res.status(429).json({ error: 'Too many join attempts' });
  }

  /* Three ways a player gets a seat, one endpoint, one rule: the Discord id is
     never taken from the body.

       discord  a Discord Activity auto-join, keyed on the Activity instance
       host     "Host room" on the web — creates the room and seats the host
       join     "Join with a code" on the web

     `action` is explicit, but an absent one falls back to `discord` when an
     instanceId is present so a client mid-deploy is not broken by the field
     appearing. Web seats previously recorded no discord id at all, which is
     why a web player's multiplayer results stayed unanchored. */
  const action = String(req.body?.action || (req.body?.instanceId ? 'discord' : '')).trim();
  const name = String(req.body?.name || '').trim();
  const mode = String(req.body?.mode || 'languages');
  const settings = req.body?.settings;

  if (!['discord', 'host', 'join'].includes(action)) {
    return res.status(400).json({ error: 'Bad action' });
  }
  if (!name || name.length > 24) return res.status(400).json({ error: 'Bad name' });
  if (settings != null && (typeof settings !== 'object' || Array.isArray(settings))) {
    return res.status(400).json({ error: 'Bad settings' });
  }

  // The verified identity. Every branch below passes this and nothing else.
  const discordId = String(session.sub);
  let fn;
  let args;

  if (action === 'discord') {
    const instanceId = String(req.body?.instanceId || '').trim();
    if (!instanceId || instanceId.length > 128) return res.status(400).json({ error: 'Bad instanceId' });
    if (!MODES.has(mode)) return res.status(400).json({ error: 'Bad mode' });
    fn = 'join_discord_room';
    args = {
      p_instance_id: instanceId,
      p_mode: mode,
      p_settings: settings || {},
      p_player_name: name,
      p_discord_user_id: discordId
    };
  } else if (action === 'host') {
    if (!MODES.has(mode)) return res.status(400).json({ error: 'Bad mode' });
    fn = 'create_room';
    args = {
      p_mode: mode,
      p_settings: settings || {},
      p_host_name: name,
      p_discord_id: discordId
    };
  } else {
    // Room codes are 4 characters; normalise the way the client does so a
    // lowercase or padded code is not rejected here before the RPC sees it.
    const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) return res.status(400).json({ error: 'Bad code' });
    fn = 'join_room';
    args = { p_code: code, p_name: name, p_discord_id: discordId };
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Multiplayer is not configured' });

  try {
    const rpcRes = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    const text = await rpcRes.text();
    if (!rpcRes.ok) {
      console.error(`${fn} failed:`, rpcRes.status, text);
      /* Surface the RPC's own refusal rather than a blanket 502. "Room not
         found", "Game already started" and "Name already taken in this room"
         are things the player can act on, and the web join flow shows them —
         swallowing them all as "Could not join the room" would make a mistyped
         code indistinguishable from an outage. PostgREST reports a raised
         exception as 400. */
      let detail = null;
      try { detail = JSON.parse(text)?.message || null; } catch (e) { /* not json */ }
      if (rpcRes.status === 400 && detail) return res.status(400).json({ error: detail });
      return res.status(502).json({ error: 'Could not join the room' });
    }
    return res.status(200).json({ ok: true, room: text ? JSON.parse(text) : null });
  } catch (err) {
    console.error('join-room endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Could not join the room' });
  }
};
