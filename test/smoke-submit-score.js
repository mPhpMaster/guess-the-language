'use strict';

/* Validation contract of /api/submit-score, driven through the real handler with
   a stubbed fetch. No network, no database — plain node.
     node test/smoke-submit-score.js                                            */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const handler = require('../api/submit-score');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const DISCORD_ID = '123456789012345678';
const token = signSession(DISCORD_ID, { uname: 'tester' });

// Capture what would have been sent to Supabase.
let lastInsert = null;
global.fetch = async (url, opts) => {
  lastInsert = { url: String(url), body: JSON.parse(opts.body)[0] };
  return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 7 }]) };
};

function call(body, auth = `Bearer ${token}`, method = 'POST') {
  const req = { method, headers: { authorization: auth }, body };
  let code = 0, payload = null;
  const res = {
    setHeader() {},
    status(c) { code = c; return res; },
    json(p) { payload = p; return res; },
    end() { return res; }
  };
  return handler(req, res).then(() => ({ code, payload }));
}

(async () => {
  const ok = { player: 'Tester', score: 1200, mode: 'languages', board: 'scores' };

  check('rejects a non-POST', (await call(ok, `Bearer ${token}`, 'GET')).code === 405);
  check('rejects a missing token', (await call(ok, '')).code === 401);
  check('rejects a forged token', (await call(ok, 'Bearer aaa.bbb')).code === 401);

  let r = await call(ok);
  check('accepts a valid submission', r.code === 200, `code=${r.code}`);
  check('inserts into scores', lastInsert && /\/scores$/.test(lastInsert.url));
  check('returns the inserted row', r.payload && r.payload.row && r.payload.row.id === 7);

  check('rejects a score above the round ceiling',
    (await call({ ...ok, score: 21001 })).code === 400);
  check('accepts a score at the ceiling',
    (await call({ ...ok, score: 21000 })).code === 200);
  check('rejects a negative score', (await call({ ...ok, score: -1 })).code === 400);
  check('rejects a non-integer score', (await call({ ...ok, score: 12.5 })).code === 400);
  check('rejects a non-numeric score', (await call({ ...ok, score: 'lots' })).code === 400);
  check('rejects an unknown mode', (await call({ ...ok, mode: 'wizardry' })).code === 400);
  check('rejects an empty player', (await call({ ...ok, player: '  ' })).code === 400);
  check('rejects an over-long player', (await call({ ...ok, player: 'x'.repeat(25) })).code === 400);

  // The avatar must belong to the authenticated user.
  await call({ ...ok, avatar: `https://cdn.discordapp.com/avatars/${DISCORD_ID}/abc.png` });
  check('keeps the caller\'s own avatar', lastInsert.body.avatar !== null);
  await call({ ...ok, avatar: 'https://evil.example.com/tracker.png' });
  check('drops a foreign avatar URL', lastInsert.body.avatar === null);
  await call({ ...ok, avatar: 'https://cdn.discordapp.com/avatars/999/abc.png' });
  check('drops another user\'s avatar', lastInsert.body.avatar === null);

  // The durable identity comes from the SIGNED session, never from the body, so
  // a client cannot post under someone else's Discord id.
  await call({ ...ok, discord_id: '999999999999999999' });
  check('stamps the session\'s discord id', lastInsert.body.discord_id === DISCORD_ID,
    lastInsert.body.discord_id);
  check('ignores a discord id supplied in the body',
    lastInsert.body.discord_id !== '999999999999999999');

  // Daily board routes to the other table and forces multiplayer off.
  await call({ player: 'Tester', score: 500, board: 'daily' });
  check('daily goes to daily_scores', /\/daily_scores$/.test(lastInsert.url));
  check('daily rows carry the discord id too', lastInsert.body.discord_id === DISCORD_ID);
  check('single-player rows are never flagged multiplayer',
    (await call(ok), lastInsert.body.multiplayer === false));

  // Burst throttle: 20 per window, and we are already well past it.
  let throttled = false;
  for (let i = 0; i < 25; i++) if ((await call(ok)).code === 429) { throttled = true; break; }
  check('throttles a burst from one identity', throttled);

  let passed = 0;
  console.log('\n==== SUBMIT-SCORE VALIDATION TEST ====');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
    if (c.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  process.exitCode = passed === checks.length ? 0 : 1;
})();
