import { bearer, verifySession } from './_session.js';

/**
 * Report a leaderboard entry.
 *
 * The write uses the service-role key so `leaderboard_reports` can stay closed
 * to anon, and the reporter's Discord id comes from the signed session rather
 * than the request body — a client cannot report as someone else.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySession(bearer(req));
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const scoreId = Number(req.body?.score_id);
  const reason = req.body?.reason;
  const details = String(req.body?.details || '').trim().slice(0, 250) || null;
  const allowedReasons = new Set(['offensive_name', 'impersonation', 'spam_other']);
  if (!Number.isSafeInteger(scoreId) || scoreId <= 0 || !allowedReasons.has(reason)) {
    return res.status(400).json({ error: 'Invalid report' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Reporting is not configured' });

  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/leaderboard_reports`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        score_id: scoreId,
        reporter_discord_id: String(session.sub),
        reason,
        details
      })
    });
    // A unique index makes a second report of the same entry a 409, which the
    // client turns into "you already reported this" rather than a failure.
    if (result.status === 409) return res.status(409).json({ error: 'Already reported' });
    if (!result.ok) {
      console.error('Report insert failed:', result.status, await result.text());
      return res.status(502).json({ error: 'Could not save report' });
    }
    return res.status(204).end();
  } catch (error) {
    console.error('Report endpoint error:', error);
    return res.status(500).json({ error: 'Could not save report' });
  }
}
