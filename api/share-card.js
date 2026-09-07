'use strict';

const crypto = require('crypto');
const { verifySession } = require('./_session');

/**
 * Upload a share-card PNG.
 *
 * The client used to PUT straight into the public `share-cards` bucket with the
 * anon key. migration-anon-write-bounds.sql pinned the object NAME to the shape
 * the client writes, and said plainly what that did not buy: nothing stopped
 * anyone uploading an unlimited number of perfectly valid 3MB cards. Volume is
 * not expressible in RLS, so capping it means moving the write behind a door
 * that can count — which is this.
 *
 * What changes:
 *   - a signed session is required, so uploads are attributable and countable;
 *   - a per-identity rate limit applies;
 *   - the server names the object, so the caller cannot choose a path;
 *   - the body is checked to actually be a PNG, not merely named like one.
 *
 * Anonymous and desktop players simply do not get a hosted card. That is a real
 * reduction — the share sheet falls back to the local blob, which still works
 * everywhere except the Discord iframe — and it is the trade the bucket needs:
 * a public, writable, permanent store with no owner is the one thing here that
 * costs money to abuse.
 */

const MAX_BYTES = 3 * 1024 * 1024; // matches the bucket's own file_size_limit
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Cards are a share action, not a game loop: a handful per session is plenty.
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = String(req.headers.authorization || '');
  const session = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  if (rateLimited(String(session.sub))) {
    return res.status(429).json({ error: 'Too many cards' });
  }

  // The card arrives base64-encoded because this route takes JSON; a binary
  // body would need a raw-body config that Vercel's JSON parser fights.
  const b64 = typeof req.body?.png === 'string' ? req.body.png : '';
  if (!b64) return res.status(400).json({ error: 'Missing card' });
  // 4/3 expansion plus padding; reject before allocating anything large.
  if (b64.length > Math.ceil(MAX_BYTES / 3) * 4 + 16) {
    return res.status(413).json({ error: 'Card too large' });
  }

  let png;
  try { png = Buffer.from(b64, 'base64'); } catch { return res.status(400).json({ error: 'Bad card' }); }
  if (!png.length || png.length > MAX_BYTES) return res.status(413).json({ error: 'Card too large' });
  // Named like a PNG is not the same as being one. The bucket enforces the
  // declared MIME type, which the uploader also declares.
  if (!png.subarray(0, 8).equals(PNG_MAGIC)) {
    return res.status(400).json({ error: 'Not a PNG' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Sharing is not configured' });

  // The server names the object. The caller never supplies a path, so it cannot
  // overwrite another card or place one outside the expected shape.
  const name = `card-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;

  try {
    const put = await fetch(`${url}/storage/v1/object/share-cards/${name}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
      body: png
    });
    if (!put.ok) {
      console.error('share-card upload failed:', put.status, await put.text());
      return res.status(502).json({ error: 'Could not save the card' });
    }
    return res.status(200).json({
      ok: true,
      url: `${url}/storage/v1/object/public/share-cards/${name}`
    });
  } catch (err) {
    console.error('share-card endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Could not save the card' });
  }
};
