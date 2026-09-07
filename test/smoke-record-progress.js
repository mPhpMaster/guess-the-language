'use strict';

/* Contract of /api/record-progress, driven through the real handler with a
   stubbed fetch. No network, no database — plain node.
     node test/smoke-record-progress.js

   Why this endpoint exists: player_stats is keyed on a self-asserted display
   name, so a rename orphans a player's level, streak and achievements and a
   freed name carries the profile to whoever takes it next. The discord_id
   column to fix that has existed since migration-score-integrity.sql, but
   record_progress() had no parameter for it, so 0 of 1080 rows carried one.

   The assertion that matters is the same one as every other identity fix here:
   the id sent to the RPC comes from the SIGNED SESSION and ignores the body. */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const handler = require('../api/record-progress');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const ME = '111111111111111111';
const OTHER = '999999999999999999';
const token = signSession(ME, { uname: 'tester' });

let lastRpc = null;
global.fetch = async (url, opts) => {
  lastRpc = { url: String(url), body: JSON.parse(opts.body), headers: opts.headers };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ level: 3, xp: 4000, day_streak: 2, new_achievements: ['rookie'] })
  };
};

function call(body, auth = `Bearer ${token}`, method = 'POST') {
  const req = { method, headers: { authorization: auth }, body };
  let code = 0;
  let payload = null;
  const res = {
    setHeader() {},
    status(c) { code = c; return res; },
    json(p) { payload = p; return res; },
    end() { return res; }
  };
  return handler(req, res).then(() => ({ code, payload }));
}

(async () => {
  const ok = { player: 'Tester', seconds: 120, multiplayer: false, won: false, xp: 250, perfect: false };

  check('rejects a non-POST', (await call(ok, `Bearer ${token}`, 'GET')).code === 405);
  check('rejects a missing token', (await call(ok, '')).code === 401);
  check('rejects a forged token', (await call(ok, 'Bearer aaa.bbb')).code === 401);

  let r = await call(ok);
  check('accepts an authenticated round', r.code === 200, `code=${r.code}`);
  check('calls record_progress', lastRpc && /\/rpc\/record_progress$/.test(lastRpc.url));
  check('uses the service-role key, not anon',
    lastRpc && lastRpc.headers.apikey === 'service-role-test-key');
  check('returns the progress payload for the achievement popup',
    r.payload && r.payload.progress && r.payload.progress.level === 3);

  // --- the core guarantee -------------------------------------------------
  check('stamps the id from the SIGNED SESSION',
    lastRpc.body.p_discord_id === ME, `sent ${lastRpc.body.p_discord_id}`);

  await call({ ...ok, discord_id: OTHER });
  check('ignores a discord_id in the body',
    lastRpc.body.p_discord_id === ME, `body claimed ${OTHER}`);

  await call({ ...ok, p_discord_id: OTHER });
  check('ignores a raw p_discord_id in the body',
    lastRpc.body.p_discord_id === ME, `body claimed ${OTHER}`);

  await call(ok, `Bearer ${signSession(OTHER, { uname: 'other' })}`);
  check('a different session stamps a different id',
    lastRpc.body.p_discord_id === OTHER, 'the id must track the token');

  // --- the fields still have to survive the trip ---------------------------
  await call({ player: 'Tester', seconds: 90, multiplayer: true, won: true, xp: 400, perfect: true });
  check('forwards the round fields unchanged',
    lastRpc.body.p_player === 'Tester' && lastRpc.body.p_seconds === 90
    && lastRpc.body.p_multiplayer === true && lastRpc.body.p_won === true
    && lastRpc.body.p_xp === 400 && lastRpc.body.p_perfect === true,
    JSON.stringify(lastRpc.body));

  // --- input bounds -------------------------------------------------------
  check('rejects an empty player', (await call({ ...ok, player: '  ' })).code === 400);
  check('rejects an over-long player', (await call({ ...ok, player: 'x'.repeat(25) })).code === 400);
  check('rejects negative seconds', (await call({ ...ok, seconds: -1 })).code === 400);
  check('rejects absurd seconds', (await call({ ...ok, seconds: 86401 })).code === 400);
  check('rejects a non-integer seconds', (await call({ ...ok, seconds: 1.5 })).code === 400);
  check('rejects negative xp', (await call({ ...ok, xp: -1 })).code === 400);
  check('rejects xp above a round ceiling', (await call({ ...ok, xp: 5001 })).code === 400);
  check('rejects a non-numeric xp', (await call({ ...ok, xp: 'lots' })).code === 400);
  check('accepts zero seconds and zero xp',
    (await call({ ...ok, seconds: 0, xp: 0 })).code === 200);

  // --- upstream failure ---------------------------------------------------
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  check('reports an upstream failure as 502', (await call(ok)).code === 502);
  global.fetch = async () => { throw new Error('network down'); };
  check('survives a thrown fetch', (await call(ok)).code === 502);

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed += 1;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  }
  console.log(`\n==== ${checks.length - failed}/${checks.length} passed ====`);
  process.exit(failed ? 1 : 0);
})();
