'use strict';

const { verifySession } = require('./_session');

/**
 * Per-question feedback, two actions behind one function (the Vercel plan caps
 * the number of serverless functions, so related writes share an endpoint):
 *
 *   report   a player flags a question (wrong answer, unclear, typo...). One
 *            report per player per question — question_reports is unique on
 *            (bank, question_id, reporter_discord_id). Reviewed in the admin
 *            panel's Questions tab.
 *   answers  the outcome of every question in a finished round, folded into
 *            question_stats (attempts / correct per question) by the
 *            record_question_answers() RPC. The admin Stats tab reads it to
 *            find questions that are too hard — often a sign they are wrong.
 *
 * Both need a signed session (so one person cannot flood either table from a
 * script with the anon key), and both write with the service-role key only.
 * Tables: supabase/migration-question-feedback.sql.
 */

const BANKS = new Set([
  'languages', 'cybersecurity', 'devops', 'network', 'gamedev',
  'algorithms', 'bug', 'output', 'sql', 'regex', 'git', 'linux', 'ai'
]);
const REASONS = new Set(['wrong_answer', 'unclear', 'typo', 'duplicate', 'other']);
const MAX_ANSWERS = 60; // a 50-question survival run plus slack

const RATE_MAX = 60;
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

function validId(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && n < 1e6 ? n : null;
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
  if (!url || !key) return res.status(500).json({ error: 'Not configured' });
  const cfg = { url, key };
  const action = String(req.body?.action || '');

  try {
    if (action === 'report') {
      const bank = String(req.body?.bank || '');
      const id = validId(req.body?.id);
      const reason = String(req.body?.reason || '');
      const detailsRaw = String(req.body?.details || '').trim();
      if (!BANKS.has(bank) || !id) return res.status(400).json({ error: 'Bad question' });
      if (!REASONS.has(reason)) return res.status(400).json({ error: 'Bad reason' });
      const details = detailsRaw ? [...detailsRaw].slice(0, 400).join('') : null;
      try {
        await sb(cfg, 'question_reports', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{ bank, question_id: id, reason, details, reporter_discord_id: me }])
        });
      } catch (e) {
        if (e.status === 409) return res.status(409).json({ error: 'Already reported' });
        throw e;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'answers') {
      const list = Array.isArray(req.body?.answers) ? req.body.answers.slice(0, MAX_ANSWERS) : [];
      const clean = [];
      const seen = new Set();
      for (const a of list) {
        const bank = String(a && a.bank || '');
        const id = validId(a && a.id);
        if (!BANKS.has(bank) || !id) continue;
        const k = `${bank}|${id}`;
        if (seen.has(k)) continue; // one vote per question per round
        seen.add(k);
        clean.push({ bank, id, correct: !!(a && a.correct) });
      }
      if (!clean.length) return res.status(200).json({ ok: true, recorded: 0 });
      await sb(cfg, 'rpc/record_question_answers', {
        method: 'POST',
        body: JSON.stringify({ p_answers: clean })
      });
      return res.status(200).json({ ok: true, recorded: clean.length });
    }

    return res.status(400).json({ error: 'Bad action' });
  } catch (err) {
    const b = String((err && err.body) || '');
    if (/PGRST20[0-5]|42P01|42883|does not exist|Could not find/.test(b)) {
      return res.status(503).json({ error: 'Not available yet', code: 'not_migrated' });
    }
    console.error('questions endpoint error:', err && err.message);
    return res.status(502).json({ error: 'Could not save' });
  }
};
