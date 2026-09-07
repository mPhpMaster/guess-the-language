'use strict';

/* Contract of /api/follow, through the real handler with a stubbed fetch.
     node test/smoke-follow.js

   follows was the last table written straight from the client with the anon
   key, and it was wrong twice over: nothing checked the caller was the
   follower (so anyone could add follows in your name, and one unfiltered
   DELETE emptied the table), and follower_discord_id had no writer at all, so
   a rename orphaned the whole list. */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const handler = require('../api/follow');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const ME = '111111111111111111';
const OTHER = '999999999999999999';
const token = signSession(ME, { uname: 'tester' });

let calls = [];
global.fetch = async (url, opts) => {
  calls.push({ url: String(url), method: (opts && opts.method) || 'GET', headers: opts && opts.headers,
               body: opts && opts.body ? JSON.parse(opts.body) : null });
  if (String(url).includes('player_stats')) {
    return { ok: true, status: 200, json: async () => [{ discord_id: '555' }] };
  }
  return { ok: true, status: 200, text: async () => '' };
};

function call(body, auth = `Bearer ${token}`, method = 'POST') {
  calls = [];
  const req = { method, headers: { authorization: auth }, body };
  let code = 0; let payload = null;
  const res = { setHeader() {}, status(c) { code = c; return res; },
                json(p) { payload = p; return res; }, end() { return res; } };
  return handler(req, res).then(() => ({ code, payload }));
}
const wrote = () => calls.find((c) => c.url.includes('/follows'));

(async () => {
  const ok = { action: 'follow', follower: 'Me', followee: 'Them' };

  check('rejects a non-POST', (await call(ok, `Bearer ${token}`, 'GET')).code === 405);
  check('rejects a missing session', (await call(ok, '')).code === 401);
  check('rejects a forged session', (await call(ok, 'Bearer aaa.bbb')).code === 401);

  check('accepts an authenticated follow', (await call(ok)).code === 200);
  check('writes with the service-role key', wrote().headers.apikey === 'service-role-test-key');

  // --- the core guarantee -------------------------------------------------
  await call(ok);
  check('stamps follower_discord_id from the SIGNED SESSION',
    wrote().body[0].follower_discord_id === ME, `sent ${wrote().body[0].follower_discord_id}`);
  await call({ ...ok, follower_discord_id: OTHER, discordId: OTHER });
  check('ignores an id supplied in the body',
    wrote().body[0].follower_discord_id === ME, `body claimed ${OTHER}`);
  await call(ok, `Bearer ${signSession(OTHER)}`);
  check('a different session stamps a different follower',
    wrote().body[0].follower_discord_id === OTHER);

  await call(ok);
  check('also records the followee id for a later id-keyed read',
    wrote().body[0].followee_discord_id === '555', JSON.stringify(wrote().body[0]));

  // --- unfollow is scoped to the caller ------------------------------------
  await call({ action: 'unfollow', follower: 'Me', followee: 'Them' });
  const del = wrote();
  check('unfollow issues a DELETE', del.method === 'DELETE');
  check('unfollow is scoped to this caller\'s own id',
    del.url.includes(`follower_discord_id.eq.${ME}`), del.url);
  check('unfollow cannot match rows claimed by another id',
    !del.url.includes(OTHER), del.url);

  // --- input bounds --------------------------------------------------------
  check('rejects an unknown action', (await call({ ...ok, action: 'destroy' })).code === 400);
  check('rejects following yourself', (await call({ ...ok, followee: 'Me' })).code === 400);
  check('rejects following yourself case-insensitively',
    (await call({ ...ok, follower: 'Me', followee: 'ME' })).code === 400);
  check('rejects an empty followee', (await call({ ...ok, followee: '  ' })).code === 400);
  check('rejects an over-long followee', (await call({ ...ok, followee: 'x'.repeat(25) })).code === 400);
  check('rejects an empty follower', (await call({ ...ok, follower: '' })).code === 400);

  // --- a followee who has never signed in -----------------------------------
  // The id lookup returns nothing; the follow must still be written, with a
  // null followee id rather than failing or throwing.
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: (opts && opts.method) || 'GET',
                 headers: opts && opts.headers, body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('player_stats')) return { ok: true, status: 200, json: async () => [] };
    return { ok: true, status: 200, text: async () => '' };
  };
  const unclaimed = await call(ok);
  check('a followee with no claimed profile still follows', unclaimed.code === 200,
    `code=${unclaimed.code}`);
  check('and records a null followee id rather than inventing one',
    wrote().body[0].followee_discord_id === null, JSON.stringify(wrote().body[0]));

  // --- upstream failure ----------------------------------------------------
  global.fetch = async (url) => String(url).includes('player_stats')
    ? { ok: true, status: 200, json: async () => [] }
    : { ok: false, status: 500, text: async () => 'boom' };
  check('reports an upstream failure as 502', (await call(ok)).code === 502);

  global.fetch = async () => { throw new Error('network down'); };
  check('survives a thrown fetch', (await call(ok)).code === 502);

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed += 1;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail && !c.pass ? `  (${c.detail})` : ''}`);
  }
  console.log(`\n==== ${checks.length - failed}/${checks.length} passed ====`);
  process.exit(failed ? 1 : 0);
})();
