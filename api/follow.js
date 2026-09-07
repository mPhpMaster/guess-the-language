'use strict';

const { verifySession } = require('./_session');

/**
 * Follow / unfollow another player.
 *
 * `follows` was the last table written straight from the client with the anon
 * key, and it had two problems at once.
 *
 * Identity: follower_discord_id was added by migration-score-integrity.sql and
 * never written by anything, so a rename orphaned your entire follow list — the
 * same "column with no writer" that left player_stats at zero.
 *
 * Authorisation: the row said who you were following and nothing checked that
 * you were the follower. migration-anon-write-bounds.sql split the old
 * `FOR ALL ... USING (true)` policy and removed UPDATE, but INSERT and DELETE
 * stayed open with no way to scope them — RLS has no identity to scope to when
 * every caller is `anon`. So anyone could add follows in your name, and one
 * unfiltered DELETE still emptied the table.
 *
 * Both close the same way: the write moves behind a signed session, the anon
 * write policies are dropped, and the row records the ids the server verified.
 *
 * Reads stay open and keyed on names, deliberately. The endpoint records
 * followee_discord_id as well, so a future switch to id-keyed reads has the
 * data waiting rather than starting from zero again — that being the whole
 * lesson of step (b).
 */

const RATE_MAX = 60;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

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

function sb(cfg, path, opts = {}) {
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
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
    return res.status(429).json({ error: 'Too many follow changes' });
  }

  const action = String(req.body?.action || '');
  const follower = String(req.body?.follower || '').trim();
  const followee = String(req.body?.followee || '').trim();

  if (action !== 'follow' && action !== 'unfollow') {
    return res.status(400).json({ error: 'Bad action' });
  }
  if (!follower || follower.length > 24) return res.status(400).json({ error: 'Bad follower' });
  if (!followee || followee.length > 24) return res.status(400).json({ error: 'Bad followee' });
  if (follower.toLowerCase() === followee.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Following is not configured' });
  const cfg = { url, key };

  // The follower's display name is still what the row is keyed on, but the id
  // beside it comes from the session — so the row is attributable even though
  // the name is not.
  const followerId = String(session.sub);

  try {
    if (action === 'unfollow') {
      /* Scoped to this caller's own follower_discord_id when the row has one.
         A row written before this endpoint existed carries no id, so it can
         only be matched by name — which is the same exposure as before for
         those rows, and they age out as people re-follow. New rows can only be
         removed by the identity that created them. */
      const q = `follows?followee=eq.${encodeURIComponent(followee)}`
        + `&or=(follower_discord_id.eq.${encodeURIComponent(followerId)},`
        + `and(follower_discord_id.is.null,follower.eq.${encodeURIComponent(follower)}))`;
      const del = await sb(cfg, q, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if (!del.ok) {
        console.error('unfollow failed:', del.status, await del.text());
        return res.status(502).json({ error: 'Could not unfollow' });
      }
      return res.status(200).json({ ok: true });
    }

    // Record the followee's id too when they have a claimed profile, so a later
    // switch to id-keyed reads has the data rather than starting from nothing.
    let followeeId = null;
    try {
      const look = await sb(cfg,
        `player_stats?select=discord_id&player=eq.${encodeURIComponent(followee)}`
        + '&discord_id=not.is.null&order=last_seen.desc.nullslast&limit=1');
      if (look.ok) {
        const rows = await look.json();
        followeeId = (rows && rows[0] && rows[0].discord_id) || null;
      }
    } catch (e) { /* decoration only; never fail a follow over it */ }

    const ins = await sb(cfg, 'follows', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{
        follower, followee,
        follower_discord_id: followerId,
        followee_discord_id: followeeId
      }])
    });
    if (!ins.ok) {
      console.error('follow failed:', ins.status, await ins.text());
      return res.status(502).json({ error: 'Could not follow' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('follow endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Could not update follows' });
  }
};
