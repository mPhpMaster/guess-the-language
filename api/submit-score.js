'use strict';

const { verifySession } = require('./_session');

/**
 * Authenticated score submission for single-player rounds.
 *
 * Until now the client POSTed straight to the `scores` table with the PUBLIC anon
 * key, and the only RLS check was `score >= 0`. Anyone who opened devtools could
 * post any number under any name, so the global leaderboard was unauthenticated
 * and unbounded. (Multiplayer never had this problem: room scores are computed by
 * the submit_answer RPC inside Postgres, so they are already server-authoritative.
 * This endpoint closes the single-player half.)
 *
 * What it actually guarantees:
 *   - the caller holds a valid HMAC-signed session token, i.e. a real Discord
 *     identity this server minted in /api/token or /api/discord-login;
 *   - the score is within what the game can arithmetically produce;
 *   - a burst of submissions from one identity is throttled.
 *
 * What it does NOT guarantee: that the round was really played. A determined
 * cheater can still post a plausible score for a round they did not play. Closing
 * that needs server-issued rounds and server-side grading — the model multiplayer
 * already uses. This is the bound, not the proof.
 */

// The ceiling the game can actually produce in one round.
//   scoreAnswer() = round((100 + 10 * timeLeft) * multiplier)   [src/modules/round.js]
//   timeLeft <= the question's time, and the longest selectable timer is 60s
//   multiplier maxes at 1.5 (streak >= 3)
//   => per question: (100 + 10 * 60) * 1.5 = 1050
//   questions per round is a fixed list topping out at 20  [src/index.html]
//   => 20 * 1050 = 21000
// Keep this in step with those two lists if either ever grows.
const MAX_ROUND_SCORE = 21000;

const MODES = new Set([
  'languages', 'cybersecurity', 'devops', 'network', 'gamedev', 'algorithms', 'all'
]);

// Best-effort throttle. Serverless instances do not share memory, so a caller
// spread across instances gets more attempts — it still turns scripted spam into
// something far slower than an unthrottled loop. Same caveat as /api/admin.
const RATE_MAX = 20;
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

// Only this user's own Discord avatar, so the field cannot be used to point the
// leaderboard at an arbitrary URL.
function safeAvatar(avatar, discordId) {
  if (typeof avatar !== 'string' || !avatar) return null;
  const expected = `https://cdn.discordapp.com/avatars/${discordId}/`;
  return avatar.startsWith(expected) && avatar.length <= 300 ? avatar : null;
}

async function sbInsert(cfg, path, row, prefer) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: JSON.stringify([row])
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
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

  const score = Number(req.body?.score);
  const player = String(req.body?.player || '').trim();
  const board = req.body?.board === 'daily' ? 'daily' : 'scores';
  const mode = String(req.body?.mode || 'languages');

  if (!Number.isSafeInteger(score) || score < 0 || score > MAX_ROUND_SCORE) {
    return res.status(400).json({ error: 'Score out of range' });
  }
  if (!player || player.length > 24) return res.status(400).json({ error: 'Bad player name' });
  if (board === 'scores' && !MODES.has(mode)) return res.status(400).json({ error: 'Bad mode' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Scoring is not configured' });
  const cfg = { url, key };

  const avatar = safeAvatar(req.body?.avatar, session.sub);

  try {
    if (board === 'daily') {
      // The unique (day, player) plus ignore-duplicates means the FIRST score of
      // the day stands and replays are a silent no-op — same rule as before.
      const day = new Date().toISOString().slice(0, 10); // UTC, matches dailyDateKey()
      await sbInsert(cfg, 'daily_scores', { day, player, score, avatar },
        'resolution=ignore-duplicates,return=minimal');
      return res.status(200).json({ ok: true });
    }

    const rows = await sbInsert(cfg, 'scores',
      { player, score, mode, multiplayer: false, avatar }, 'return=representation');
    return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : null });
  } catch (err) {
    console.error('submit-score failed:', err && err.message);
    return res.status(502).json({ error: 'Could not save score' });
  }
};
