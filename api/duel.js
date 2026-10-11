'use strict';

const { verifySession } = require('./_session');

/**
 * Ranked duel: matchmaking + Elo ratings.
 *
 * Matchmaking rides on ordinary multiplayer rooms. A player who finds nobody
 * waiting hosts a ranked room and posts its code here as an OFFER; the next
 * player to search TAKES that offer (atomically, so two searchers can never grab
 * the same one) and joins the room by code. When nobody shows up in time the
 * client cancels its offer and plays a bot instead.
 *
 * Ratings are written only here, with the service-role key:
 *   - a human duel is rated from the room's own server-computed scores
 *     (room_players.score, settled in Postgres), never from client claims, and
 *     each room is rated once (duel_results.room_id is the primary key);
 *   - a bot duel is the client's word, like a single-player score, so it moves
 *     the rating at a lower K and the bot's rating is clamped near the player's.
 *
 * Tables (supabase/migration-ranked-duel.sql): duel_queue, duel_results and the
 * duel_* columns on player_stats. All service-role only.
 */

const START_RATING = 1000;
const K_HUMAN = 32;
const K_BOT = 12;
const OFFER_TTL_S = 30;

const RATE_MAX = 120;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [k, rec] of hits) if (now - rec.first > RATE_WINDOW_MS) hits.delete(k);
  }
  const rec = hits.get(key);
  if (!rec || now - rec.first > RATE_WINDOW_MS) { hits.set(key, { count: 1, first: now }); return false; }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

// Bot results are self-reported, so they are throttled on their own.
const BOT_MAX = 15;
const BOT_WINDOW_MS = 60 * 60 * 1000;
const botHits = new Map();
function botLimited(key) {
  const now = Date.now();
  const rec = botHits.get(key);
  if (!rec || now - rec.first > BOT_WINDOW_MS) { botHits.set(key, { count: 1, first: now }); return false; }
  rec.count += 1;
  return rec.count > BOT_MAX;
}

function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function elo(rating, opp, outcome, k) {
  return Math.max(100, Math.round(rating + k * (outcome - expected(rating, opp))));
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
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

// A missing table/column/function means the migration has not been applied yet.
function notMigrated(err) {
  const b = String((err && err.body) || '');
  return /PGRST20[0-5]|42P01|42703|42883|does not exist|Could not find/.test(b);
}

async function readRating(cfg, discordId) {
  const rows = await sb(cfg, `player_stats?select=player,duel_rating,duel_wins,duel_losses,duel_draws&discord_id=eq.${encodeURIComponent(discordId)}&order=last_seen.desc.nullslast&limit=1`);
  const r = rows && rows[0];
  return r
    ? { rating: r.duel_rating ?? START_RATING, wins: r.duel_wins || 0, losses: r.duel_losses || 0, draws: r.duel_draws || 0, player: r.player }
    : { rating: START_RATING, wins: 0, losses: 0, draws: 0, player: null };
}

async function writeRating(cfg, discordId, rating, outcome) {
  const cur = await readRating(cfg, discordId);
  if (!cur.player) return false; // no profile row yet; the next round creates it
  const patch = {
    duel_rating: rating,
    duel_wins: cur.wins + (outcome === 1 ? 1 : 0),
    duel_losses: cur.losses + (outcome === 0 ? 1 : 0),
    duel_draws: cur.draws + (outcome === 0.5 ? 1 : 0)
  };
  await sb(cfg, `player_stats?discord_id=eq.${encodeURIComponent(discordId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  return true;
}

function safeName(v) {
  const s = String(v || '').trim();
  return s && [...s].length <= 24 ? s : null;
}
function safeAvatar(v, discordId) {
  const s = String(v || '');
  return s.startsWith(`https://cdn.discordapp.com/avatars/${discordId}/`) && s.length <= 300 ? s : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = String(req.headers.authorization || '');
  const session = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  const me = String(session.sub);
  if (rateLimited(me)) return res.status(429).json({ error: 'Too many requests' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Duels are not configured' });
  const cfg = { url, key };
  const action = String(req.body?.action || '');

  try {
    if (action === 'me') {
      const r = await readRating(cfg, me);
      return res.status(200).json({ ok: true, rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws });
    }

    if (action === 'queue') {
      // Take the best waiting offer, atomically. The RPC deletes the row it
      // returns, so a second searcher cannot get the same room.
      const r = await readRating(cfg, me);
      const taken = await sb(cfg, 'rpc/duel_take_offer', {
        method: 'POST',
        body: JSON.stringify({ p_discord_id: me, p_rating: r.rating, p_ttl_seconds: OFFER_TTL_S })
      });
      const offer = Array.isArray(taken) ? taken[0] : taken;
      if (offer && offer.code) {
        return res.status(200).json({ ok: true, rating: r.rating, match: { code: offer.code, name: offer.name, rating: offer.rating, avatar: offer.avatar } });
      }
      return res.status(200).json({ ok: true, rating: r.rating, waiting: true });
    }

    if (action === 'offer') {
      const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const roomId = String(req.body?.roomId || '');
      if (code.length !== 4 || !/^[0-9a-f-]{36}$/i.test(roomId)) return res.status(400).json({ error: 'Bad room' });
      // The room must really be this player's own fresh ranked lobby.
      const seats = await sb(cfg, `room_players?select=id&room_id=eq.${roomId}&discord_user_id=eq.${encodeURIComponent(me)}&limit=1`);
      if (!seats || !seats.length) return res.status(403).json({ error: 'Not your room' });
      const r = await readRating(cfg, me);
      await sb(cfg, 'duel_queue', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{
          discord_id: me, name: safeName(req.body?.name) || 'Player', avatar: safeAvatar(req.body?.avatar, me),
          rating: r.rating, code, room_id: roomId, created_at: new Date().toISOString()
        }])
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'cancel') {
      // return=representation tells the caller whether the offer was still
      // there. Gone means somebody took it a moment ago, so the host should
      // give that player a few more seconds to arrive before falling back.
      const gone = await sb(cfg, `duel_queue?discord_id=eq.${encodeURIComponent(me)}`, {
        method: 'DELETE', headers: { Prefer: 'return=representation' }
      });
      return res.status(200).json({ ok: true, taken: !(gone && gone.length) });
    }

    if (action === 'result') {
      const roomId = String(req.body?.roomId || '');
      if (!/^[0-9a-f-]{36}$/i.test(roomId)) return res.status(400).json({ error: 'Bad room' });
      const existing = await sb(cfg, `duel_results?room_id=eq.${roomId}&limit=1`);
      const rooms = await sb(cfg, `rooms?select=id,status,settings&id=eq.${roomId}&limit=1`);
      const room = rooms && rooms[0];
      if (!room || !room.settings || room.settings.ranked !== true) return res.status(400).json({ error: 'Not a ranked room' });
      if (room.status !== 'finished') return res.status(409).json({ error: 'Duel not finished' });
      const players = (await sb(cfg, `room_players?select=discord_user_id,score,name,spectator&room_id=eq.${roomId}`) || [])
        .filter((p) => !p.spectator && p.discord_user_id);
      const mine = players.find((p) => String(p.discord_user_id) === me);
      if (!mine) return res.status(403).json({ error: 'Not in this duel' });
      const opp = players.find((p) => String(p.discord_user_id) !== me);
      if (!opp || players.length !== 2) return res.status(400).json({ error: 'A duel needs exactly two players' });

      let row = existing && existing[0];
      if (!row) {
        const [a, b] = [mine, opp].sort((x, y) => String(x.discord_user_id).localeCompare(String(y.discord_user_id)));
        const ra = (await readRating(cfg, String(a.discord_user_id))).rating;
        const rb = (await readRating(cfg, String(b.discord_user_id))).rating;
        const outA = a.score > b.score ? 1 : a.score < b.score ? 0 : 0.5;
        const na = elo(ra, rb, outA, K_HUMAN);
        const nb = elo(rb, ra, 1 - outA, K_HUMAN);
        try {
          const ins = await sb(cfg, 'duel_results', {
            method: 'POST', headers: { Prefer: 'return=representation' },
            body: JSON.stringify([{
              room_id: roomId, a_discord: String(a.discord_user_id), b_discord: String(b.discord_user_id),
              a_score: a.score, b_score: b.score, a_before: ra, a_after: na, b_before: rb, b_after: nb
            }])
          });
          row = ins && ins[0];
          // Only the request that inserted the result applies it.
          await writeRating(cfg, String(a.discord_user_id), na, outA);
          await writeRating(cfg, String(b.discord_user_id), nb, 1 - outA);
        } catch (e) {
          if (e.status !== 409) throw e;
          row = (await sb(cfg, `duel_results?room_id=eq.${roomId}&limit=1`))[0];
        }
      }
      const iAmA = row.a_discord === me;
      const myScore = iAmA ? row.a_score : row.b_score;
      const oppScore = iAmA ? row.b_score : row.a_score;
      return res.status(200).json({
        ok: true,
        before: iAmA ? row.a_before : row.b_before,
        after: iAmA ? row.a_after : row.b_after,
        outcome: myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw',
        opponent: { name: opp.name, score: oppScore }
      });
    }

    if (action === 'bot') {
      if (botLimited(me)) return res.status(429).json({ error: 'Too many bot duels — try again later' });
      const outcomeRaw = String(req.body?.outcome || '');
      const outcome = outcomeRaw === 'win' ? 1 : outcomeRaw === 'loss' ? 0 : outcomeRaw === 'draw' ? 0.5 : null;
      if (outcome == null) return res.status(400).json({ error: 'Bad outcome' });
      const cur = await readRating(cfg, me);
      // The bot's rating is the client's, but it may only sit near the player's own.
      const claimed = Number(req.body?.botRating);
      const botRating = Number.isFinite(claimed)
        ? Math.max(cur.rating - 150, Math.min(cur.rating + 150, Math.round(claimed)))
        : cur.rating;
      const next = elo(cur.rating, botRating, outcome, K_BOT);
      const saved = await writeRating(cfg, me, next, outcome);
      return res.status(200).json({ ok: true, before: cur.rating, after: saved ? next : cur.rating, saved });
    }

    return res.status(400).json({ error: 'Bad action' });
  } catch (err) {
    if (notMigrated(err)) return res.status(503).json({ error: 'Duels are not available yet', code: 'not_migrated' });
    console.error('duel endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Duel service error' });
  }
};
