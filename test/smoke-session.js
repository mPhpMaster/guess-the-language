'use strict';

/* Contract of api/_session.js — the root of every auth decision in the app.
     node test/smoke-session.js

   Two properties this file guards, both of which were once wrong:

   1. A token minted for one purpose must not be accepted for another.
      verifySession() used to be the shared implementation with verifyUnlock()
      layered on top, so an unlock token satisfied every session gate.

   2. Tokens must not be signed with the raw configured secret. When
      APP_SESSION_SECRET is unset that value is the Discord OAuth client
      secret, so one string did two unrelated jobs and rotating it at Discord
      would have silently invalidated every session. */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = 'test-secret-for-smoke-only';
process.env.APP_SESSION_SECRET = SECRET;
delete process.env.DISCORD_CLIENT_SECRET;

const S = require('../api/_session');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const now = () => Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signWith = (key, payload) =>
  `${payload}.${crypto.createHmac('sha256', key).update(payload).digest('base64url')}`;

// --- signing + round trip ---------------------------------------------------
const session = S.signSession('u1', { adm: true, uname: 'tester' });
check('signs a session token', typeof session === 'string' && session.includes('.'));
check('verifies its own token', !!S.verifySession(session));
check('carries the subject', S.verifySession(session).sub === 'u1');
check('carries the signed adm claim', S.verifySession(session).adm === true);

// --- the claims must be unforgeable ----------------------------------------
const tampered = `${b64({ sub: 'u1', adm: true, exp: now() + 3600 })}.${session.split('.')[1]}`;
check('rejects an edited payload', S.verifySession(tampered) === null);
check('rejects a token signed with another secret',
  S.verifySession(signWith('wrong-secret', b64({ sub: 'u1', exp: now() + 3600 }))) === null);
check('rejects a malformed token', S.verifySession('not-a-token') === null);
check('rejects an empty token', S.verifySession('') === null);
check('rejects a null token', S.verifySession(null) === null);
check('rejects an expired token',
  S.verifySession(S.signSession('u1', {}, -1)) === null);

// --- key derivation ---------------------------------------------------------
// The signature must NOT be reproducible from the configured value directly.
const payload = session.split('.')[0];
check('is not signed with the raw configured secret',
  session.split('.')[1] !== crypto.createHmac('sha256', SECRET).update(payload).digest('base64url'),
  'signing with the raw value means the Discord OAuth secret signs sessions');
check('is signed with the derived key',
  session.split('.')[1] === crypto.createHmac('sha256',
    crypto.createHmac('sha256', 'gtl.session.v1').update(SECRET).digest())
    .update(payload).digest('base64url'));

/* Transitional: tokens issued before the key derivation must keep working for
   their seven days. v3.26.2 deployed 2026-09-08, and a session lives 7 days, so
   the last legacy-signed token expires 2026-09-15 — one day later than the
   fourteenth, because a token signed in the final hours of the 8th is still
   valid through the 14th.

   From that date the second branch in decodeToken() is dead weight that keeps
   the OLD key valid, which is most of what deriving a new one was for. Rather
   than rely on anyone remembering, the check below FAILS once the date has
   passed while the branch is still there, and says exactly what to remove. */
const LEGACY_DEAD_FROM = Date.parse('2026-09-15T00:00:00Z');
const legacyBranchPresent = /matches\(rawSecret\(\)\)/.test(
  fs.readFileSync(path.join(__dirname, '..', 'api', '_session.js'), 'utf-8')
);

if (Date.now() < LEGACY_DEAD_FROM) {
  const legacy = signWith(SECRET, b64({ sub: 'u1', adm: true, exp: now() + 3600 }));
  check('still accepts a token signed the old way (transition window)',
    !!S.verifySession(legacy) && S.verifySession(legacy).adm === true);
  check('the transition branch is still present, as it should be during the window',
    legacyBranchPresent);
} else {
  check('the transition branch has been REMOVED (window closed 2026-09-15)',
    !legacyBranchPresent,
    [
      'Every token signed with the raw secret has now expired, so accepting that',
      'signature only keeps the old key alive — which is most of what deriving a',
      'new one was for. In api/_session.js, decodeToken() currently reads:',
      '',
      '    if (!matches(key) && !matches(rawSecret())) return null;',
      '',
      'Change it to:',
      '',
      '    if (!matches(key)) return null;',
      '',
      'then delete this else-branch and the LEGACY_DEAD_FROM constant above.'
    ].join('\n        '));
}

// --- the two token kinds are distinct ---------------------------------------
const unlock = S.signUnlock('u1');
check('an unlock token verifies as an unlock', S.verifyUnlock(unlock, 'u1') === true);
check('an unlock token is REFUSED as a session', S.verifySession(unlock) === null);
check('a session token is REFUSED as an unlock', S.verifyUnlock(session, 'u1') === false);
check('an unlock token is bound to its user', S.verifyUnlock(unlock, 'u2') === false);

// --- admin identity ---------------------------------------------------------
check('the owner is an admin', S.isAdminUsername('alhlack') === true);
check('admin matching ignores case and padding', S.isAdminUsername('  ALHLACK ') === true);
check('a stranger is not an admin', S.isAdminUsername('someone-else') === false);
check('an empty username is not an admin', S.isAdminUsername('') === false);

// --- passcode ---------------------------------------------------------------
process.env.ADMIN_PASSCODE = ' s3cret ';
check('a configured passcode is recognised', S.checkAdminPasscode('s3cret') === true,
  'surrounding whitespace from a CLI pipe must not break it forever');
check('a wrong passcode is refused', S.checkAdminPasscode('nope') === false);
check('an empty passcode is refused', S.checkAdminPasscode('') === false);
delete process.env.ADMIN_PASSCODE;

// --- no secret configured ---------------------------------------------------
delete process.env.APP_SESSION_SECRET;
check('signs nothing without a secret', S.signSession('u1') === null);
check('verifies nothing without a secret', S.verifySession(session) === null,
  'fails closed rather than accepting anything');
process.env.APP_SESSION_SECRET = SECRET;

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed += 1;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail && !c.pass ? `\n        ${c.detail}` : ''}`);
}
console.log(`\n==== ${checks.length - failed}/${checks.length} passed ====`);
process.exit(failed ? 1 : 0);
