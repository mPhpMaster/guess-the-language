'use strict';

/* Multiplayer seat-token regression test (plain node, no Electron, no network).
   Run: node test/smoke-mp-auth.js

   Guards the fix in supabase/migration-mp-seat-tokens.sql. Before it, every
   host-only RPC proved authority with a client-supplied room_players.id — a
   value `anon` can SELECT straight out of room_players, with the room's
   host_player_id readable from `rooms`. Two unauthenticated GETs and you could
   start, end, restart, re-configure, kick from or hand away any room without
   joining it; leave_room checked nothing at all; and submit_answer returned the
   correct answer on a wrong guess while allowing you to resubmit.

   Two halves:
     A. Drive the real src/multiplayer.js against a recording stub and assert
        every room RPC carries the seat token it was issued.
     B. Read the migration and assert the SQL side kept its end of the bargain.
   Half A alone would pass against a server that ignores the token; half B alone
   would pass against a client that never sends one. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const PLAYER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = '44444444-4444-4444-8444-444444444444';

// ---------------------------------------------------------------------------
// A. Client behaviour
// ---------------------------------------------------------------------------

const rpcCalls = [];
const tableReads = [];

function makeQuery(rows) {
  // Every builder method returns `this`, and awaiting it resolves to the
  // PostgREST shape. .single() collapses to the first row.
  const q = {
    _rows: rows,
    select() { return q; },
    eq() { return q; },
    order() { return q; },
    single() { q._single = true; return q; },
    then(resolve) {
      resolve({ data: q._single ? (q._rows[0] || null) : q._rows, error: null });
      return Promise.resolve();
    }
  };
  return q;
}

const room = {
  id: ROOM_ID, status: 'lobby', mode: 'languages', host_player_id: PLAYER_ID,
  settings: {}, round_refs: null, question_index: 0, phase: 'question',
  question_ends_at: null, created_at: new Date().toISOString(), finished_at: null,
  discord_instance_id: null
};
const players = [
  { id: PLAYER_ID, room_id: ROOM_ID, name: 'me', score: 0, is_host: true, spectator: false, joined_at: '2020-01-01T00:00:00Z' },
  { id: OTHER_ID, room_id: ROOM_ID, name: 'other', score: 0, is_host: false, spectator: false, joined_at: '2020-01-02T00:00:00Z' }
];

const channel = { on() { return channel; }, subscribe() { return channel; } };

const stubClient = {
  rpc(name, params) {
    rpcCalls.push({ name, params });
    if (name === 'create_room') {
      return Promise.resolve({
        data: { roomId: ROOM_ID, code: 'ABCD', playerId: PLAYER_ID, playerToken: TOKEN },
        error: null
      });
    }
    if (name === 'room_answers_for') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: room, error: null });
  },
  from(table) {
    tableReads.push(table);
    return makeQuery(table === 'rooms' ? [room] : players);
  },
  channel() { return channel; },
  removeChannel() {}
};

const store = new Map();
const sandbox = {
  console,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  clearTimeout,
  Date,
  Math,
  JSON,
  Promise,
  Error,
  Number,
  String,
  Array,
  Object,
  fetch: (url, opts) => { sandbox.__beacon = { url, opts }; return Promise.resolve({ ok: true, catch() {} }); },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  }
};
sandbox.window = sandbox;
sandbox.SUPABASE_CONFIG = { url: 'https://stub.supabase.co', anonKey: 'anon-key' };
sandbox.supabase = { createClient: () => stubClient };

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'multiplayer.js'), 'utf-8'), sandbox, {
  filename: 'src/multiplayer.js'
});

const MP = sandbox.window.GTL_MULTIPLAYER;

function callsTo(name) {
  return rpcCalls.filter((c) => c.name === name);
}

async function run() {
  await MP.hostRoom('languages', {}, 'me');

  check('create_room hands back a seat token the client keeps',
    MP.state.playerToken === TOKEN,
    `playerToken=${MP.state.playerToken}`);

  check('the seat token is NOT the (publicly readable) player id',
    !!MP.state.playerToken && MP.state.playerToken !== MP.state.playerId,
    'a credential anyone can SELECT is not a credential');

  await MP.startRoom([{ index: 0, duration: 15 }], [{ index: 0, answer: 'x' }]);
  await MP.submitAnswer('x', 12);
  await MP.updateRoomSettings('languages', {});
  await MP.kickPlayer(OTHER_ID);
  await MP.makeHost(OTHER_ID);
  await MP.endRoom();
  await MP.restartRoom();
  await MP.fetchAnswers(0);

  // Every RPC that acts as this player must carry the token.
  const SEATED = ['start_room', 'submit_answer', 'update_room_settings',
    'kick_player', 'make_host', 'end_room', 'restart_room'];
  for (const name of SEATED) {
    const calls = callsTo(name);
    check(`${name} sends the seat token`,
      calls.length > 0 && calls.every((c) => c.params.p_token === TOKEN),
      calls.length ? JSON.stringify(calls[0].params) : 'never called');
  }

  check('submit_answer no longer sends a client-supplied clock',
    callsTo('submit_answer').every((c) => !('p_time_left' in c.params)),
    'p_time_left was unbounded above: any value scored');

  check('reveal answers come from the gated RPC, not the raw table',
    callsTo('room_answers_for').length === 1 && !tableReads.includes('room_answers'),
    `tableReads=${JSON.stringify([...new Set(tableReads)])}`);

  // leave_room is the one that had no check at all.
  await MP.leaveRoom();
  check('leave_room sends the seat token',
    callsTo('leave_room').length === 1 && callsTo('leave_room')[0].params.p_token === TOKEN,
    JSON.stringify(callsTo('leave_room')[0] || null));

  check('teardown forgets the seat token',
    MP.state.playerToken === null,
    `playerToken=${MP.state.playerToken}`);

  // The unload beacon is a raw POST that bypasses the rpc() helper, so it is
  // the easiest place for the token to be forgotten.
  await MP.hostRoom('languages', {}, 'me');
  MP.leaveBeacon();
  const beaconBody = JSON.parse((sandbox.__beacon && sandbox.__beacon.opts.body) || '{}');
  check('the unload beacon carries the seat token too',
    beaconBody.p_token === TOKEN,
    JSON.stringify(beaconBody));

  check('adoptSession refuses a seat with no token',
    await MP.adoptSession({ roomId: ROOM_ID, playerId: PLAYER_ID }).then(() => false, () => true),
    'the admin-panel join path must carry one as well');
}

// ---------------------------------------------------------------------------
// B. The SQL half
// ---------------------------------------------------------------------------

function checkMigration() {
  const p = path.join(ROOT, 'supabase', 'migration-mp-seat-tokens.sql');
  if (!fs.existsSync(p)) {
    check('migration-mp-seat-tokens.sql exists', false, p);
    return;
  }
  const sql = fs.readFileSync(p, 'utf-8');
  const norm = sql.replace(/\s+/g, ' ');

  const HOST_RPCS = ['start_room', 'end_room', 'restart_room',
    'update_room_settings', 'kick_player', 'make_host'];
  for (const fn of HOST_RPCS) {
    const m = norm.match(new RegExp(`create function public\\.${fn}\\s*\\(([^)]*)\\)`, 'i'));
    check(`${fn} takes a token parameter`,
      !!m && /p_token uuid/.test(m[1]),
      m ? m[1] : 'no create function found');
  }

  check('the old 2-argument host check is dropped',
    /drop function if exists public\._assert_admin\(uuid, uuid\)/i.test(norm),
    'leaving it callable invites the next RPC to reintroduce the hole');

  for (const fn of ['start_room(uuid, uuid, jsonb, jsonb)', 'end_room(uuid, uuid)',
    'restart_room(uuid, uuid)', 'update_room_settings(uuid, uuid, text, jsonb)',
    'kick_player(uuid, uuid, uuid)', 'make_host(uuid, uuid, uuid)',
    'leave_room(uuid, uuid)', 'submit_answer(uuid, uuid, text, int)']) {
    check(`the tokenless ${fn.split('(')[0]} overload is dropped`,
      norm.includes(`drop function if exists public.${fn}`),
      'an overload left in place is the hole sitting next to its own fix');
  }

  check('leave_room proves the seat before deleting it',
    /create function public\.leave_room[\s\S]*?_assert_seat/.test(norm),
    'it used to delete whatever player id it was handed');

  const sa = norm.match(/create function public\.submit_answer[\s\S]*?\$\$;/);
  const saBody = sa ? sa[0] : '';
  check('submit_answer stops returning the correct answer',
    !!saBody && !/'correctAnswer'/.test(saBody),
    'submit garbage, read correctAnswer, resubmit = a guaranteed 100%');
  check('submit_answer stops returning per-submission correctness',
    !!saBody && !/'isCorrect'/.test(saBody),
    'with resubmission allowed, "wrong, wrong, right" is a free answer key');
  check('submit_answer derives the remaining time from question_ends_at',
    /question_ends_at/.test(saBody),
    'the client-supplied clock was only floored at zero');
  check('submit_answer refuses spectators',
    /Spectators cannot answer/.test(saBody),
    'a spectator answer also mis-counted the "everyone answered" check');

  check('room_answers is no longer readable with the anon key',
    /revoke select on public\.room_answers from anon/i.test(norm)
    && /drop policy if exists "public read room_answers"/i.test(norm),
    'it stores each pick and its is_correct the moment it lands');

  check('the token table is unreachable from the anon key',
    /alter table public\.room_player_tokens enable row level security/i.test(norm)
    && /revoke all on public\.room_player_tokens from anon/i.test(norm)
    && !/create policy[^;]*room_player_tokens/i.test(norm),
    'RLS with no policy, plus an explicit revoke');

  for (const fn of ['create_room', 'join_room', 'join_discord_room', 'admin_join_room']) {
    check(`${fn} issues a seat token`,
      new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?_issue_player_token`).test(norm),
      'every path that seats a player must hand one out');
  }
}

run()
  .then(checkMigration, (err) => {
    check('client half ran without throwing', false, String(err && err.stack || err));
  })
  .then(() => {
    let failed = 0;
    for (const c of checks) {
      if (!c.pass) failed += 1;
      console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : `\n        ${c.detail}`}`);
    }
    console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
    process.exit(failed ? 1 : 0);
  });
