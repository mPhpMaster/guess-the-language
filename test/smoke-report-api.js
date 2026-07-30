'use strict';

const { signSession, verifySession } = require('../api/_session');

process.env.APP_SESSION_SECRET = 'test-session-secret';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const handler = require('../api/report');
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

(async () => {
  const token = signSession('discord-123');
  check('signed session verifies', verifySession(token)?.sub === 'discord-123');
  check('tampered session is rejected', verifySession(`${token}x`) === null);

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 204, text: async () => '' };
  };
  const req = {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: { score_id: 42, reason: 'offensive_name', details: 'Review this name' }
  };
  const ok = response();
  await handler(req, ok);
  check('authenticated report is accepted', ok.statusCode === 204, ok.statusCode);
  check('report uses service-role authorization', calls[0]?.options?.headers?.Authorization === 'Bearer test-service-key');
  check('report identity comes from signed session', /"reporter_discord_id":"discord-123"/.test(calls[0]?.options?.body || ''));

  const unauth = response();
  await handler({ ...req, headers: {} }, unauth);
  check('unauthenticated report is rejected', unauth.statusCode === 401, unauth.statusCode);

  const invalid = response();
  await handler({ ...req, body: { score_id: 42, reason: 'not-valid' } }, invalid);
  check('invalid reason is rejected', invalid.statusCode === 400, invalid.statusCode);

  global.fetch = async () => ({ ok: false, status: 409, text: async () => 'duplicate' });
  const duplicate = response();
  await handler(req, duplicate);
  check('duplicate report returns conflict', duplicate.statusCode === 409, duplicate.statusCode);

  let passed = 0;
  console.log('\n==== REPORT API TEST ====');
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? `  (${item.detail})` : ''}`);
    if (item.pass) passed++;
  }
  console.log(`==== ${passed}/${checks.length} passed ====\n`);
  process.exitCode = passed === checks.length ? 0 : 1;
})();
