'use strict';

/* Contract of /api/join-room, driven through the real handler with a stubbed
   fetch. No network, no database — plain node.
     node test/smoke-join-room.js

   The bug this guards: join_discord_room seats a player under whatever Discord
   id the caller names, and its rejoin path hands back the EXISTING seat for that
   id — including that seat's token. Both inputs an attacker needed were readable
   with the public anon key (rooms.discord_instance_id and
   room_players.discord_user_id), so anyone could replay them and take a player's
   seat; if the victim was the host, the room went too.

   The single most important assertion here is that the Discord id sent to the
   RPC comes from the SIGNED SESSION and never from the request body. */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const handler = require('../api/join-room');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const ME = '111111111111111111';
const VICTIM = '999999999999999999';
const token = signSession(ME, { uname: 'tester' });

let lastRpc = null;
global.fetch = async (url, opts) => {
  lastRpc = { url: String(url), body: JSON.parse(opts.body), headers: opts.headers };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ roomId: 'r1', code: 'ABCD', playerId: 'p1', playerToken: 't1' })
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
  const ok = { action: 'discord', instanceId: 'inst-abc', mode: 'languages', settings: {}, name: 'Tester' };

  check('rejects a non-POST', (await call(ok, `Bearer ${token}`, 'GET')).code === 405);

  // Fail closed: this is the whole point of the endpoint.
  check('rejects a missing session token', (await call(ok, '')).code === 401);
  check('rejects a forged session token', (await call(ok, 'Bearer aaa.bbb')).code === 401);
  check('rejects a token signed with the wrong secret',
    (await call(ok, `Bearer ${signSession(ME).split('.')[0]}.deadbeef`)).code === 401);

  let r = await call(ok);
  check('accepts an authenticated join', r.code === 200, `code=${r.code}`);
  check('calls join_discord_room', lastRpc && /\/rpc\/join_discord_room$/.test(lastRpc.url));
  check('uses the service-role key, not anon',
    lastRpc && lastRpc.headers.apikey === 'service-role-test-key');
  check('returns the seat, token included',
    r.payload && r.payload.room && r.payload.room.playerToken === 't1');

  // --- the core guarantee -------------------------------------------------
  check('seats the caller under the id from the SIGNED SESSION',
    lastRpc.body.p_discord_user_id === ME,
    `sent ${lastRpc.body.p_discord_user_id}`);

  await call({ ...ok, discordUserId: VICTIM });
  check('ignores a discordUserId in the body',
    lastRpc.body.p_discord_user_id === ME,
    `body claimed ${VICTIM}, sent ${lastRpc.body.p_discord_user_id}`);

  await call({ ...ok, p_discord_user_id: VICTIM });
  check('ignores a raw p_discord_user_id in the body',
    lastRpc.body.p_discord_user_id === ME,
    `body claimed ${VICTIM}, sent ${lastRpc.body.p_discord_user_id}`);

  const victimToken = signSession(VICTIM, { uname: 'victim' });
  await call(ok, `Bearer ${victimToken}`);
  check('a different session seats a different player',
    lastRpc.body.p_discord_user_id === VICTIM,
    'the id must track the token, not the body');

  // --- input bounds -------------------------------------------------------
  check('rejects a missing instanceId', (await call({ ...ok, instanceId: '  ' })).code === 400);
  check('rejects an over-long instanceId',
    (await call({ ...ok, instanceId: 'x'.repeat(129) })).code === 400);
  check('rejects a missing name', (await call({ ...ok, name: '' })).code === 400);
  check('rejects an over-long name', (await call({ ...ok, name: 'x'.repeat(25) })).code === 400);
  check('rejects an unknown mode', (await call({ ...ok, mode: 'wizardry' })).code === 400);
  check('rejects non-object settings', (await call({ ...ok, settings: 'nope' })).code === 400);
  check('rejects array settings', (await call({ ...ok, settings: [1, 2] })).code === 400);
  check('accepts absent settings', (await call({ ...ok, settings: undefined })).code === 200);

  // --- the web seat paths -------------------------------------------------
  // These existed as unauthenticated RPCs, so a web player's seat carried no
  // discord id and their multiplayer results stayed unanchored.
  const host = { action: 'host', mode: 'languages', settings: {}, name: 'Tester' };
  check('hosting a room is accepted', (await call(host)).code === 200);
  check('hosting calls create_room', /\/rpc\/create_room$/.test(lastRpc.url));
  check('hosting seats the SIGNED SESSION id',
    lastRpc.body.p_discord_id === ME, `sent ${lastRpc.body.p_discord_id}`);
  await call({ ...host, discordId: VICTIM, p_discord_id: VICTIM });
  check('hosting ignores an id in the body',
    lastRpc.body.p_discord_id === ME, `body claimed ${VICTIM}`);

  const join = { action: 'join', code: 'ab3d', name: 'Tester' };
  check('joining by code is accepted', (await call(join)).code === 200);
  check('joining calls join_room', /\/rpc\/join_room$/.test(lastRpc.url));
  check('joining seats the SIGNED SESSION id',
    lastRpc.body.p_discord_id === ME, `sent ${lastRpc.body.p_discord_id}`);
  check('joining normalises the room code', lastRpc.body.p_code === 'AB3D',
    `sent ${lastRpc.body.p_code}`);
  await call({ ...join, p_discord_id: VICTIM });
  check('joining ignores an id in the body',
    lastRpc.body.p_discord_id === ME, `body claimed ${VICTIM}`);

  check('rejects an unknown action', (await call({ ...host, action: 'wizardry' })).code === 400);
  check('rejects a missing action with no instanceId',
    (await call({ mode: 'languages', name: 'Tester' })).code === 400);
  check('a bare instanceId still means discord (mid-deploy clients)',
    (await call({ instanceId: 'inst-abc', mode: 'languages', name: 'Tester' })).code === 200
    && /join_discord_room$/.test(lastRpc.url));
  check('rejects a short room code', (await call({ ...join, code: 'ab' })).code === 400);
  check('rejects a missing room code', (await call({ action: 'join', name: 'Tester' })).code === 400);

  // --- upstream failure ---------------------------------------------------
  // A raised RPC exception is the player's problem, not an outage: PostgREST
  // reports it as 400 and the join dialog shows the reason.
  global.fetch = async () => ({
    ok: false, status: 400, text: async () => JSON.stringify({ message: 'Room not found' })
  });
  let bad = await call(join);
  check('passes a room-not-found through as 400', bad.code === 400, `code=${bad.code}`);
  check('and keeps the reason', bad.payload && bad.payload.error === 'Room not found',
    JSON.stringify(bad.payload));

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
