'use strict';

/* What can a stranger actually reach?

   Probes PRODUCTION with the public anon key — the same key every visitor's
   browser holds, read straight out of the deployed client config and never
   printed. This is the only check in the suite that tests the deployed
   database rather than a stub, which is the point: RLS, column grants and
   function grants are properties of the live project, and every offline test
   here would keep passing if someone loosened one of them tomorrow.

     node test/probe-anon-surface.js

   NOT part of `pnpm test:data` — it needs the network and hits production.
   Run it after any migration that touches grants or policies.

   It performs no writes. The RPC probes are expected to be rejected outright;
   they use ids that do not exist so that even a regression that re-opened one
   could not change anything real.  */

const SITE = 'https://guess-the-language-chi.vercel.app';

(async () => {
  const cfg = await fetch(`${SITE}/supabase-config.js`).then((r) => r.text());
  const url = /url:\s*"([^"]+)"/.exec(cfg)[1];
  const key = /anonKey:\s*"([^"]+)"/.exec(cfg)[1];
  if (!url || !key) throw new Error('could not read the deployed supabase config');

  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const results = [];

  // `rows` counts what actually came back. It matters because there are two
  // different ways a table can be closed, and only one of them is an error:
  //   - grant revoked            -> HTTP 401 (room_answers, room_player_tokens)
  //   - RLS on with no policy    -> HTTP 200 with [] (error_logs, presence, ...)
  // Both protect the data. Asserting "denied" alone would wrongly flag the
  // second, and asserting "no rows" alone would pass a table that 401s for an
  // unrelated reason, so each probe says which shape it expects.
  async function get(label, path, expect) {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: H });
    const body = await r.text();
    let rows = null;
    try { const j = JSON.parse(body); rows = Array.isArray(j) ? j.length : null; } catch (e) {}
    results.push({
      label, status: r.status, rows, ok: expect(r.status, rows),
      hint: r.ok ? `rows=${rows}` : body.slice(0, 90)
    });
  }
  async function rpc(label, fn, args, expect) {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
    const body = await r.text();
    results.push({ label, status: r.status, ok: expect(r.status), hint: r.ok ? body.slice(0, 60) : body.slice(0, 90) });
  }

  const ok2xx = (s) => s >= 200 && s < 300;
  const denied = (s) => s === 401 || s === 403 || s === 404;
  // Reachable, but RLS hands back nothing.
  const empty = (s, rows) => s >= 200 && s < 300 && rows === 0;

  // --- things that MUST still work for the game to function ---
  await get('leaderboard readable', 'scores?select=player,score&limit=1', ok2xx);
  await get('rooms readable (allowed columns)', 'rooms?select=id,status,phase&limit=1', ok2xx);
  await get('room_players readable', 'room_players?select=id,name&limit=1', ok2xx);

  // --- things that MUST now be closed ---
  await get('rooms.code hidden', 'rooms?select=code&limit=1', denied);
  await get('rooms.discord_instance_id hidden', 'rooms?select=discord_instance_id&limit=1', denied);
  await get('room_answers unreadable', 'room_answers?select=answer&limit=1', denied);
  await get('room_player_tokens unreadable', 'room_player_tokens?select=token&limit=1', denied);
  await get('error_logs yields no rows', 'error_logs?select=message&limit=1', empty);
  await get('presence yields no rows', 'presence?select=player&limit=1', empty);
  await get('banned_players yields no rows', 'banned_players?select=player&limit=1', empty);

  await rpc('join_discord_room revoked', 'join_discord_room',
    { p_instance_id: 'probe', p_mode: 'languages', p_settings: {}, p_player_name: 'probe', p_discord_user_id: '1' },
    denied);
  await rpc('tokenless leave_room gone', 'leave_room',
    { p_room_id: '00000000-0000-4000-8000-000000000000', p_player_id: '00000000-0000-4000-8000-000000000000' },
    denied);
  await rpc('tokenless submit_answer gone', 'submit_answer',
    { p_room_id: '00000000-0000-4000-8000-000000000000', p_player_id: '00000000-0000-4000-8000-000000000000', p_answer: 'x', p_time_left: 999999 },
    denied);
  await rpc('tokenless kick_player gone', 'kick_player',
    { p_room_id: '00000000-0000-4000-8000-000000000000', p_admin_player_id: '00000000-0000-4000-8000-000000000000', p_target_player_id: '00000000-0000-4000-8000-000000000000' },
    denied);
  await rpc('admin_* stays service-role only', 'admin_ban',
    { p_player: 'probe', p_reason: 'probe', p_by: 'probe' }, denied);

  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad += 1;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(38)} HTTP ${String(r.status).padEnd(4)}${r.ok ? '' : '   <- ' + r.hint}`);
  }
  console.log(`\n==== ${results.length - bad}/${results.length} passed (probed as anon, from outside) ====`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1); });
