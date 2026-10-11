'use strict';

/* Contracts of /api/duel and /api/questions, driven through the real handlers
   with a stubbed fetch standing in for Supabase. No network — plain node.
     node test/smoke-duel-questions.js                                         */

process.env.APP_SESSION_SECRET = 'test-secret-for-smoke-only';
process.env.VITE_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

const { signSession } = require('../api/_session');
const duel = require('../api/duel');
const questions = require('../api/questions');
const submitScore = require('../api/submit-score');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

const ME = '111111111111111111';
const OPP = '222222222222222222';
const token = signSession(ME, { uname: 'tester' });
const ROOM = '0b5c8a3e-1d2f-4a6b-9c8d-7e6f5a4b3c2d';

// A tiny in-memory Supabase: just the rows these handlers touch.
let db;
let calls;
function reset() {
  db = {
    player_stats: { [ME]: { player: 'Me', duel_rating: 1000, duel_wins: 0, duel_losses: 0, duel_draws: 0 },
                    [OPP]: { player: 'Opp', duel_rating: 1000, duel_wins: 0, duel_losses: 0, duel_draws: 0 } },
    duel_results: [],
    room: { id: ROOM, status: 'finished', settings: { ranked: true } },
    room_players: [
      { discord_user_id: ME, score: 900, name: 'Me', spectator: false },
      { discord_user_id: OPP, score: 400, name: 'Opp', spectator: false }
    ],
    offer: null,
    migrated: true
  };
  calls = [];
}
const reply = (status, body) => ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });

global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const p = u.pathname.replace('/rest/v1/', '');
  const method = opts.method || 'GET';
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ p, method, body, q: u.search });
  if (!db.migrated) return reply(400, { code: 'PGRST204', message: 'Could not find the column' });
  const idOf = () => decodeURIComponent((u.search.match(/discord_id=eq\.([^&]+)/) || [])[1] || '');
  if (p === 'player_stats' && method === 'GET') {
    const r = db.player_stats[idOf()];
    return reply(200, r ? [r] : []);
  }
  if (p === 'player_stats' && method === 'PATCH') {
    Object.assign(db.player_stats[idOf()], body);
    return reply(204);
  }
  if (p === 'rpc/duel_take_offer') return reply(200, db.offer ? [db.offer] : []);
  if (p === 'room_players' && /discord_user_id=eq/.test(u.search)) {
    return reply(200, db.room_players.filter((x) => u.search.includes(x.discord_user_id)).map(() => ({ id: 'x' })));
  }
  if (p === 'room_players') return reply(200, db.room_players);
  if (p === 'rooms') return reply(200, [db.room]);
  if (p === 'duel_queue' && method === 'POST') { db.offer = body[0]; return reply(201); }
  if (p === 'duel_queue' && method === 'DELETE') { const had = db.offer; db.offer = null; return reply(200, had ? [had] : []); }
  if (p === 'duel_results' && method === 'GET') return reply(200, db.duel_results);
  if (p === 'duel_results' && method === 'POST') {
    if (db.duel_results.length) return reply(409, { message: 'duplicate' });
    db.duel_results.push(body[0]);
    return reply(201, [body[0]]);
  }
  if (p === 'question_reports') {
    const dup = (db.reports || []).some((r) => r.bank === body[0].bank && r.question_id === body[0].question_id && r.reporter_discord_id === body[0].reporter_discord_id);
    if (dup) return reply(409, { message: 'duplicate' });
    (db.reports = db.reports || []).push(body[0]);
    return reply(201);
  }
  if (p === 'rpc/record_question_answers') { db.answers = body.p_answers; return reply(204); }
  if (p === 'scores') return reply(201, [{ id: 9 }]);
  return reply(404, { message: 'unexpected ' + p });
};

function call(handler, body, auth = `Bearer ${token}`) {
  const req = { method: 'POST', headers: { authorization: auth }, body };
  let code = 0, payload = null;
  const res = {
    setHeader() {},
    status(c) { code = c; return res; },
    json(x) { payload = x; return res; },
    end() { return res; }
  };
  return Promise.resolve(handler(req, res)).then(() => ({ code, payload }));
}

(async () => {
  // ---------------- /api/duel ----------------
  reset();
  check('duel: rejects a missing token', (await call(duel, { action: 'me' }, '')).code === 401);
  let r = await call(duel, { action: 'me' });
  check('duel: me returns the stored rating', r.code === 200 && r.payload.rating === 1000);

  r = await call(duel, { action: 'queue' });
  check('duel: queue with nobody waiting says wait', r.code === 200 && r.payload.waiting === true);
  db.offer = { code: 'AB12', name: 'Opp', rating: 1010, avatar: null };
  r = await call(duel, { action: 'queue' });
  check('duel: queue hands back a waiting room', r.payload.match && r.payload.match.code === 'AB12');

  r = await call(duel, { action: 'offer', code: 'ZZ99', roomId: 'not-a-uuid' });
  check('duel: offer rejects a bad room id', r.code === 400);
  db.room_players = db.room_players.filter((x) => x.discord_user_id !== ME);
  r = await call(duel, { action: 'offer', code: 'ZZ99', roomId: ROOM });
  check('duel: offer refuses a room the caller is not in', r.code === 403);
  reset();
  r = await call(duel, { action: 'offer', code: 'zz99', roomId: ROOM, name: 'Me' });
  check('duel: offer posts the normalised code', r.code === 200 && db.offer && db.offer.code === 'ZZ99' && db.offer.discord_id === ME);
  r = await call(duel, { action: 'cancel' });
  check('duel: cancel of a live offer reports not taken', r.code === 200 && r.payload.taken === false);
  r = await call(duel, { action: 'cancel' });
  check('duel: cancel of a gone offer reports taken', r.payload.taken === true);

  // Human result: rated once, from the room's own scores.
  reset();
  r = await call(duel, { action: 'result', roomId: ROOM });
  check('duel: result rates the winner up', r.code === 200 && r.payload.outcome === 'win' && r.payload.after > r.payload.before, JSON.stringify(r.payload));
  check('duel: loser rated down by the same amount', db.player_stats[OPP].duel_rating === 2000 - db.player_stats[ME].duel_rating);
  check('duel: win/loss counters move', db.player_stats[ME].duel_wins === 1 && db.player_stats[OPP].duel_losses === 1);
  const afterFirst = db.player_stats[ME].duel_rating;
  r = await call(duel, { action: 'result', roomId: ROOM });
  check('duel: a second report does not re-rate', r.code === 200 && db.player_stats[ME].duel_rating === afterFirst && db.player_stats[ME].duel_wins === 1);

  reset();
  db.room.settings = {};
  check('duel: an unranked room is refused', (await call(duel, { action: 'result', roomId: ROOM })).code === 400);
  reset();
  db.room.status = 'playing';
  check('duel: an unfinished duel is refused', (await call(duel, { action: 'result', roomId: ROOM })).code === 409);
  reset();
  db.room_players = db.room_players.filter((x) => x.discord_user_id !== ME).concat([{ discord_user_id: '333', score: 1, name: 'X', spectator: false }]);
  check('duel: an outsider cannot report a result', (await call(duel, { action: 'result', roomId: ROOM })).code === 403);

  // Bot result: low K, clamped bot rating.
  reset();
  r = await call(duel, { action: 'bot', outcome: 'win', botRating: 5000 });
  check('duel: bot win clamps the bot rating (max +6 at K=12 vs +150)', r.code === 200 && r.payload.after - r.payload.before <= 8 && r.payload.after > r.payload.before, JSON.stringify(r.payload));
  check('duel: bot rejects a bad outcome', (await call(duel, { action: 'bot', outcome: 'sure' })).code === 400);
  check('duel: unknown action is refused', (await call(duel, { action: 'x' })).code === 400);

  reset();
  db.migrated = false;
  r = await call(duel, { action: 'me' });
  check('duel: before the migration it answers 503 not_migrated', r.code === 503 && r.payload.code === 'not_migrated');

  // ---------------- /api/questions ----------------
  reset();
  check('questions: rejects a missing token', (await call(questions, { action: 'report' }, '')).code === 401);
  r = await call(questions, { action: 'report', bank: 'git', id: 5, reason: 'wrong_answer', details: 'x'.repeat(900) });
  check('questions: accepts a report', r.code === 200);
  check('questions: stamps the reporter from the session', db.reports[0].reporter_discord_id === ME);
  check('questions: trims details to 400 chars', db.reports[0].details.length === 400);
  r = await call(questions, { action: 'report', bank: 'git', id: 5, reason: 'typo' });
  check('questions: a repeat report is 409', r.code === 409);
  check('questions: rejects an unknown bank', (await call(questions, { action: 'report', bank: 'nope', id: 1, reason: 'typo' })).code === 400);
  check('questions: rejects a bad id', (await call(questions, { action: 'report', bank: 'git', id: -3, reason: 'typo' })).code === 400);
  check('questions: rejects a bad reason', (await call(questions, { action: 'report', bank: 'git', id: 3, reason: 'meh' })).code === 400);

  r = await call(questions, { action: 'answers', answers: [
    { bank: 'git', id: 1, correct: true }, { bank: 'git', id: 1, correct: false },
    { bank: 'nope', id: 2, correct: true }, { bank: 'sql', id: 'x' }, { bank: 'ai', id: 4, correct: 0 }
  ] });
  check('questions: answers drops duplicates and junk', r.code === 200 && r.payload.recorded === 2 && db.answers.length === 2, JSON.stringify(db.answers));
  check('questions: answers coerces correct to boolean', db.answers[1].correct === false);
  const many = Array.from({ length: 200 }, (_, i) => ({ bank: 'languages', id: i + 1, correct: true }));
  r = await call(questions, { action: 'answers', answers: many });
  check('questions: answers caps one round at 60', r.payload.recorded === 60);

  // ---------------- /api/submit-score (new boards) ----------------
  const ok = { player: 'Tester', score: 1200, board: 'scores' };
  for (const mode of ['sql', 'regex', 'git', 'linux', 'ai', 'survival', 'speedrun', 'hardcore']) {
    check(`submit-score: accepts the ${mode} board`, (await call(submitScore, { ...ok, mode })).code === 200);
  }
  check('submit-score: survival may exceed 21000', (await call(submitScore, { ...ok, mode: 'survival', score: 40000 })).code === 200);
  check('submit-score: survival is still bounded', (await call(submitScore, { ...ok, mode: 'survival', score: 52501 })).code === 400);
  check('submit-score: other boards keep 21000', (await call(submitScore, { ...ok, mode: 'speedrun', score: 21001 })).code === 400);

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass || !c.detail ? '' : '  — ' + c.detail}`));
  console.log(`==== ${checks.length - failed.length}/${checks.length} passed ====`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
