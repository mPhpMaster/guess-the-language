import { bearer, verifySession } from './_session.js';

// ===== Admin API =====
// Every destructive capability the in-game admin panel exposes goes through here.
// Security model:
//   1. The caller must present a session token whose signed `adm` claim is true.
//      That claim is set server-side in /api/token from the real Discord username,
//      and the token is HMAC-signed, so it cannot be forged or self-granted.
//   2. Actual DB writes use the Supabase SERVICE ROLE key (never shipped to the
//      client) and go through service_role-only RPCs. anon can't reach them.
//
// The client-side `isAdmin()` only decides whether to show a button. This file is
// the authorization boundary.

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

/** Call a service_role-only RPC. */
function rpc(cfg, fn, args) {
  return sb(cfg, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySession(bearer(req));
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  if (!session.adm) return res.status(403).json({ error: 'Not an admin' });

  const cfg = sbConfig();
  if (!cfg) return res.status(500).json({ error: 'Admin API is not configured' });

  const by = String(session.uname || session.sub || 'admin');
  const action = String(req.body?.action || '');

  try {
    switch (action) {
      case 'whoami':
        return res.status(200).json({ admin: true, sub: session.sub, username: session.uname || null });

      case 'reports': {
        // Open reports first, then recently resolved; attach the reported score.
        const reports = await sb(
          cfg,
          'leaderboard_reports?select=id,score_id,reporter_discord_id,reason,details,status,created_at,resolved_at,resolved_by' +
            '&order=status.asc,created_at.desc&limit=100'
        );
        const ids = [...new Set((reports || []).map((r) => r.score_id).filter(Boolean))];
        let scoreById = {};
        if (ids.length) {
          const scores = await sb(
            cfg,
            `scores?select=id,player,score,mode,avatar,multiplayer&id=in.(${ids.join(',')})`
          );
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

      case 'banned': {
        const rows = await sb(
          cfg,
          'banned_players?select=player,reason,banned_by,created_at&order=created_at.desc&limit=200'
        );
        return res.status(200).json({ banned: rows || [] });
      }

      case 'users': {
        const search = String(req.body?.search || '').trim();
        const filter = search ? `&player=ilike.*${encodeURIComponent(search)}*` : '';
        const rows = await sb(
          cfg,
          'player_stats?select=player,level,xp,games,mp_games,wins,day_streak,perfect_games,last_seen' +
            `&order=last_seen.desc.nullslast&limit=200${filter}`
        );
        const banned = await sb(cfg, 'banned_players?select=player');
        const bannedSet = new Set((banned || []).map((b) => b.player));
        return res.status(200).json({
          users: (rows || []).map((u) => ({
            ...u,
            banned: bannedSet.has(String(u.player).trim().toLowerCase())
          }))
        });
      }

      case 'live': {
        const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const rows = await sb(
          cfg,
          'presence?select=player,discord_id,guild_id,channel_id,mode,activity,platform,updated_at' +
            `&updated_at=gte.${since}&order=updated_at.desc&limit=200`
        );
        return res.status(200).json({ live: rows || [] });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('admin action failed:', action, err && err.message);
    return res
      .status(err.status && err.status < 500 ? err.status : 500)
      .json({ error: 'Admin action failed' });
  }
}
