'use strict';

/* Contract of /api/share-card, through the real handler with a stubbed fetch.
     node test/smoke-share-card.js

   The bucket is public, writable and permanent. The client used to PUT into it
   with the anon key, so anyone could fill it with unlimited perfectly valid 3MB
   PNGs. migration-anon-write-bounds.sql pinned the object NAME and said plainly
   that this bought nothing against volume: RLS cannot express "how many".
   Counting needs a door, and this endpoint is it. */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const handler = require('../api/share-card');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const token = signSession('111111111111111111', { uname: 'tester' });
const png = (extra = 0) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(extra)])
    .toString('base64');

let last = null;
global.fetch = async (url, opts) => {
  last = { url: String(url), headers: opts.headers, body: opts.body };
  return { ok: true, status: 200, text: async () => '' };
};

function call(body, auth = `Bearer ${token}`, method = 'POST') {
  const req = { method, headers: { authorization: auth }, body };
  let code = 0; let payload = null;
  const res = {
    setHeader() {}, status(c) { code = c; return res; },
    json(p) { payload = p; return res; }, end() { return res; }
  };
  return handler(req, res).then(() => ({ code, payload }));
}

(async () => {
  check('rejects a non-POST', (await call({ png: png() }, `Bearer ${token}`, 'GET')).code === 405);
  check('rejects a missing session', (await call({ png: png() }, '')).code === 401);
  check('rejects a forged session', (await call({ png: png() }, 'Bearer aaa.bbb')).code === 401);

  const r = await call({ png: png(64) });
  check('accepts an authenticated PNG', r.code === 200, `code=${r.code}`);
  check('uploads with the service-role key', last.headers.apikey === 'service-role-test-key');
  check('returns the public URL', r.payload && /\/object\/public\/share-cards\/card-/.test(r.payload.url),
    JSON.stringify(r.payload));

  // The server names the object, so a caller cannot choose a path.
  const before = last.url;
  await call({ png: png(64), name: '../../evil.png', path: 'x/y.png' });
  check('ignores a caller-supplied name', last.url !== before && !/evil/.test(last.url), last.url);
  check('the name it chooses has the expected shape',
    /\/share-cards\/card-\d+-[0-9a-f]{8}\.png$/.test(last.url), last.url);

  // Named like a PNG is not the same as being one.
  check('rejects a non-PNG body',
    (await call({ png: Buffer.from('<svg onload=alert(1)>').toString('base64') })).code === 400);
  check('rejects an empty body', (await call({ png: '' })).code === 400);
  check('rejects a missing body', (await call({})).code === 400);

  check('rejects an oversized card',
    (await call({ png: 'A'.repeat(5 * 1024 * 1024) })).code === 413);

  // The point of the endpoint: volume.
  let limited = 0;
  for (let i = 0; i < 15; i += 1) {
    if ((await call({ png: png(8) })).code === 429) limited += 1;
  }
  check('rate-limits a burst from one identity', limited > 0, `${limited} of 15 refused`);

  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  check('reports an upstream failure as 502',
    (await call({ png: png(8) }, `Bearer ${signSession('222222222222222222')}`)).code === 502);

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed += 1;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  }
  console.log(`\n==== ${checks.length - failed}/${checks.length} passed ====`);
  process.exit(failed ? 1 : 0);
})();
