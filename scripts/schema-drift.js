'use strict';

/* Does production still match what we think it is?
 *
 *   node scripts/schema-drift.js
 *
 * Two halves, answering two different questions.
 *
 * ---------------------------------------------------------------------------
 * 1. Schema drift — does the repo DESCRIBE production?
 * ---------------------------------------------------------------------------
 * The supabase/*.sql files are hand-maintained and applied by hand, so they
 * drift from the live project silently. That is not a tidiness problem: a
 * migration written against the checked-in files failed in production because
 * admin_join_room carried `p_by text DEFAULT NULL` that the files did not show
 * ("cannot remove parameter defaults from existing function"). The files are the
 * thing everyone reads before writing SQL, so when they lie, the next migration
 * is written wrong.
 *
 * Compares FUNCTION SIGNATURES, not bodies: bodies differ in whitespace and
 * comments for no reason and would bury the real findings, while every drift
 * that has actually bitten here — a missing default, a stale parameter list, a
 * function nobody remembered existed — is visible in the signature alone.
 *
 * ---------------------------------------------------------------------------
 * 2. Security posture — is production still what we DECIDED it should be?
 * ---------------------------------------------------------------------------
 * The more important half, because that is where the damage happened. RLS,
 * policies and grants had no guard at all: eleven internal helpers were
 * reachable with the public anon key, one of them handing out the answer key.
 * Held to allowlists with written reasons rather than a plain diff — see the
 * Security posture section below for why that distinction matters.
 *
 * ---------------------------------------------------------------------------
 * Refreshing the two snapshots
 * ---------------------------------------------------------------------------
 * Both halves read a checked-in snapshot of production, because this script has
 * no database credentials. Run supabase/snapshot.sql in the Supabase SQL editor
 * and save its output over scripts/prod-security.json; keep
 * scripts/prod-functions.json in step the same way.
 *
 * A stale snapshot is the known weakness: this catches a change nobody recorded
 * only once somebody re-runs it. That is what test/probe-anon-surface.js is
 * for — it hits the live deployment with the public key and needs no snapshot.
 * Run both after any migration that touches grants or policies.
 *
 * Exits non-zero on any finding from either half.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SQL_DIR = path.join(ROOT, 'supabase');
const SNAPSHOT = path.join(__dirname, 'prod-functions.json');

// `create [or replace] function public.name(args)` — args may span lines and
// contain nested parens (numeric(10,2), default '{}'::jsonb), so match to the
// closing paren that precedes the return clause rather than the first one.
const FN_RE = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*\n?\s*returns/gi;

function normArgs(raw) {
  return raw
    .replace(/--[^\n]*/g, ' ')       // strip line comments inside the arg list
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ', ');
}

/* Postgres reports canonical type names, the schema files use the aliases a
   human types. `int` and `integer` are the same type, and reporting that pair as
   drift on six functions buried the one finding that mattered. Canonicalise
   before comparing, so the report only contains things a person should act on. */
const TYPE_ALIASES = new Map(Object.entries({
  int: 'integer', int4: 'integer', int2: 'smallint', int8: 'bigint',
  bool: 'boolean', float4: 'real', float8: 'double precision',
  decimal: 'numeric', varchar: 'character varying', char: 'character',
  timestamptz: 'timestamp with time zone', timetz: 'time with time zone',
  timestamp: 'timestamp without time zone'
}));

function canonType(t) {
  const bare = t.trim().toLowerCase().replace(/\s*\(\s*\d+(\s*,\s*\d+)?\s*\)$/, ''); // numeric(10,2) -> numeric
  const arr = bare.endsWith('[]');
  const base = arr ? bare.slice(0, -2).trim() : bare;
  return (TYPE_ALIASES.get(base) || base) + (arr ? '[]' : '');
}

// Reduce an argument list to just its types, which is what Postgres uses to
// identify a function. `p_by text default null::text` -> `text`.
function typesOf(args) {
  if (!args.trim()) return '';
  return args.split(',').map((a) => {
    const t = a.trim().split(/\s+default\s+/i)[0].trim().split(/\s+/);
    // Drop the parameter name (and any IN/OUT/VARIADIC prefix) to leave the type.
    const words = t[0].match(/^(in|out|inout|variadic)$/i) ? t.slice(1) : t;
    return canonType(words.length > 1 ? words.slice(1).join(' ') : words[0]);
  }).join(', ');
}

/* Functions belonging to the OTHER app that shares this Supabase project. They
   are live in the same schema but have nothing to do with this repo, so listing
   them as "undeclared" every run would train everyone to ignore the report.
   Named explicitly rather than pattern-matched: a new function of ours that
   nobody checked in SHOULD show up, and a silent prefix rule would hide it. */
const FOREIGN = new Set([
  'apply_faint_penalty', 'publish_score', 'set_active_monster',
  'handle_new_user', 'handle_approval', 'has_role', 'is_approved', 'is_member'
]);

function hasDefault(args) {
  return /\sdefault\s/i.test(args);
}

/* Apply order, not alphabetical order. The base schema files run first and the
   migrations run on top, so when both define a function the migration is the
   one production actually has. Sorting by filename would have reported
   schema-multiplayer.sql's end_room(uuid, uuid) as current when
   migration-mp-seat-tokens.sql had already replaced it with the 3-argument
   version — the comparison would then "find" drift that is only in the reader. */
function applyOrder(a, b) {
  const rank = (f) => (f.startsWith('migration-') ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  // Base files: schema.sql defines the shared helpers the rest build on.
  const base = ['schema.sql', 'schema-multiplayer.sql', 'schema-discord-rooms.sql', 'schema-admin.sql'];
  if (rank(a) === 0) {
    const ia = base.indexOf(a); const ib = base.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
  }
  /* Migrations, in the order they were applied to production — which is the
     order they were committed, recoverable with:
       git log --diff-filter=A --format=%ct -1 -- supabase/migration-*.sql

     KEEP THIS LIST COMPLETE. Anything missing falls through to the alphabetical
     tie-break below, which is not apply order: alphabetically
     migration-anon-score-bounds sorts before migration-mp-seat-tokens, so a
     function the latter replaced would be read from the wrong file. It only
     matters when two migrations touch the same signature, which is exactly the
     case nobody notices until the report is wrong. */
  const applied = [
    'migration-score-integrity.sql',
    'migration-anon-write-bounds.sql',
    'migration-mp-seat-tokens.sql',
    'migration-discord-join-auth.sql',
    'migration-revoke-truncate.sql',
    'migration-revoke-internal-helpers.sql',
    'migration-default-deny-execute.sql',
    'migration-identity-progress.sql',
    'migration-identity-mp-scores.sql',
    'migration-identity-web-rooms.sql',
    'migration-anon-score-bounds.sql',
    'migration-share-cards-authed.sql',
    'migration-identity-step-c.sql',
    'migration-follows-authed.sql'
  ];
  const ia = applied.indexOf(a); const ib = applied.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b); // a new migration nobody listed yet: assume newest
}

// `drop function [if exists] public.name(types)` — migrations use this to retire
// a signature, and the base schema files still declare the retired ones.
const DROP_RE = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([^)]*)\)/gi;

/* Replays the files in apply order and tracks CREATEs and DROPs together,
   because the end state is what production has and neither statement means
   anything alone. schema-multiplayer.sql still declares the pre-token
   start_room(uuid, uuid, jsonb, jsonb); migration-mp-seat-tokens.sql drops it
   and creates the 5-argument one. Counting only CREATEs reported nine
   "missing from production" findings that were simply superseded — noise that
   would have taught everyone to skim the report. */
function readRepo() {
  const declared = new Map(); // name -> [{ args, file }]

  const add = (name, args, file) => {
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push({ args, file });
  };
  const remove = (name, types) => {
    const defs = declared.get(name);
    if (!defs) return;
    const kept = defs.filter((d) => typesOf(d.args) !== types);
    if (kept.length) declared.set(name, kept); else declared.delete(name);
  };

  for (const file of fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort(applyOrder)) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf-8');
    // Drop block and line comments so commented-out DDL is not counted.
    const live = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\n]*$/gm, ' ');

    // Walk both statement kinds in source order — a file may drop a signature
    // and then create a new one under the same name.
    const events = [];
    let m;
    FN_RE.lastIndex = 0;
    while ((m = FN_RE.exec(live)) !== null) {
      events.push({ at: m.index, kind: 'create', name: m[1].toLowerCase(), args: normArgs(m[2]) });
    }
    DROP_RE.lastIndex = 0;
    while ((m = DROP_RE.exec(live)) !== null) {
      events.push({ at: m.index, kind: 'drop', name: m[1].toLowerCase(), args: normArgs(m[2]) });
    }
    events.sort((a, b) => a.at - b.at);

    for (const e of events) {
      if (e.kind === 'create') add(e.name, e.args, file);
      else remove(e.name, typesOf(e.args));
    }
  }
  return declared;
}

function main() {
  const declared = readRepo();

  if (!fs.existsSync(SNAPSHOT)) {
    console.log(`Repo declares ${declared.size} distinct function names across supabase/*.sql:\n`);
    for (const [name, defs] of [...declared].sort()) {
      const last = defs[defs.length - 1];
      console.log(`  ${name}(${typesOf(last.args)})`);
      console.log(`      ${last.file}${defs.length > 1 ? `  (+${defs.length - 1} earlier definition(s))` : ''}`);
      if (hasDefault(last.args)) console.log('      has parameter default(s)');
    }
    console.log(`\nNo ${path.relative(ROOT, SNAPSHOT)} yet — run supabase/snapshot.sql and save it there`);
    console.log('to diff these against what production actually has.');
    return 0;
  }

  const prod = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
  const key = (name, args) => `${name.toLowerCase()}/${typesOf(normArgs(args))}`;
  const prodByKey = new Map(prod.map((f) => [key(f.name, f.args), f]));
  const prodByName = new Map();
  for (const f of prod) {
    const n = f.name.toLowerCase();
    if (!prodByName.has(n)) prodByName.set(n, []);
    prodByName.get(n).push(f);
  }
  const findings = [];

  /* Compare per ARITY, not per name. A name is not unique: record_progress has
     a 6-argument overload granted to anon and a 7-argument one restricted to
     service_role, and that split is exactly what stops a caller asserting its
     own discord_id. Keying by name alone kept whichever definition came last,
     so it compared one of the repo's two declarations against one of
     production's and reported a difference that was not one. */
  const seen = new Set();
  for (const [name, defs] of declared) {
    const byTypes = new Map();
    for (const d of defs) byTypes.set(typesOf(d.args), d);
    for (const [types, d] of byTypes) {
      const k = `${name}/${types}`;
      seen.add(k);
      const p = prodByKey.get(k);
      if (!p) {
        const others = (prodByName.get(name) || []).map((f) => typesOf(normArgs(f.args)));
        findings.push([name,
          others.length
            ? `overload declared in the repo is ABSENT from production\n      repo: (${types})\n      prod has: ${others.map((o) => `(${o})`).join(', ')}`
            : 'declared in the repo, ABSENT from production',
          d.file]);
        continue;
      }
      if (hasDefault(normArgs(p.args)) !== hasDefault(normArgs(d.args))) {
        findings.push([name,
          `parameter defaults differ — this is what breaks CREATE OR REPLACE\n      repo: (${normArgs(d.args)})\n      prod: (${normArgs(p.args)})`,
          d.file]);
      }
    }
  }

  const foreign = [];
  for (const p of prod) {
    const n = p.name.toLowerCase();
    if (FOREIGN.has(n)) { foreign.push(p); continue; }
    if (seen.has(key(p.name, p.args))) continue;
    if (declared.has(n)) {
      findings.push([p.name,
        `overload live in production is NOT declared in supabase/*.sql\n      prod: (${typesOf(normArgs(p.args))})`,
        '-']);
      continue;
    }
    findings.push([p.name,
      `live in production, NOT declared anywhere in supabase/*.sql${p.anon ? ' — and anon can call it' : ''}`,
      '-']);
  }

  if (foreign.length) {
    console.log(`(ignoring ${foreign.length} functions owned by the other app sharing this project: `
      + `${foreign.map((f) => f.name).join(', ')})\n`);
  }

  if (!findings.length) {
    console.log(`No drift: ${declared.size} repo functions match production.`);
    return 0;
  }
  console.log(`${findings.length} drift finding(s):\n`);
  for (const [name, what, file] of findings.sort()) {
    console.log(`  ${name}\n      ${what}\n      ${file}\n`);
  }
  return 1;
}


// ===========================================================================
// Security posture
// ===========================================================================
/* The half above answers "does the repo describe production". This half answers
   a different question: "is production still what we decided it should be" —
   which is where the damage actually happened.

   It reads scripts/prod-security.json (regenerate with supabase/snapshot.sql)
   and holds it to invariants written as ALLOWLISTS WITH REASONS. That shape is
   the point. A plain snapshot diff tells you something changed; an allowlist
   refuses to pass until somebody writes down why the new thing is acceptable,
   and it fails on things that never appeared in a diff because nobody re-ran
   the snapshot. _answer_for_index — SECURITY DEFINER so that it could read the
   answer key, and callable by anon — would have failed here the day it was
   created.

   Deliberately NOT done by parsing supabase/*.sql to predict the end state:
   modelling create/alter/grant/revoke from SQL text well enough to be right is
   a large job, and a model that is subtly wrong emits false findings, which
   teaches everyone to skim the report. That is worse than no report. */

const SECURITY_SNAPSHOT = path.join(__dirname, 'prod-security.json');

// Tables anon may write to at all. A table-level privilege means nothing on its
// own — RLS decides — so these are the ones where a policy grants the verb.
const ALLOWED_ANON_WRITES = {
  'scores:INSERT':
    'Electron desktop has no /api and no session. Bounded by '
    + 'migration-anon-score-bounds.sql: score ceiling, safe name, multiplayer=false, '
    + 'known mode, own Discord avatar or none.',
  'daily_scores:INSERT':
    'Same caller, same bounds, plus a today/yesterday date window.',
  'error_logs:INSERT':
    'Best-effort client error reporting from every platform. Row size and field '
    + 'lengths bounded by migration-anon-write-bounds.sql; reads are closed.'
};

// Functions a stranger may call. Keyed by full signature on purpose: a new
// overload is a new entry point, and the tokenless room RPCs were overloads.
const ALLOWED_ANON_FUNCTIONS = {
  'claim_host(p_room_id uuid)': 'Heals a hostless room to its earliest joiner. Grants the caller nothing.',
  'cleanup_rooms()': 'Reaps stale rooms. No arguments, no caller-controlled effect.',
  'create_room(p_mode text, p_settings jsonb, p_host_name text)': 'Unauthenticated host path for Electron; records no discord id.',
  'join_room(p_code text, p_name text)': 'Unauthenticated join path for Electron; records no discord id.',
  'end_room(p_room_id uuid, p_player_id uuid, p_token uuid)': 'Host action, proved by the seat token.',
  'kick_player(p_room_id uuid, p_admin_player_id uuid, p_token uuid, p_target_player_id uuid)': 'Host action, proved by the seat token.',
  'leave_room(p_room_id uuid, p_player_id uuid, p_token uuid)': 'Own seat only, proved by the seat token.',
  'make_host(p_room_id uuid, p_player_id uuid, p_token uuid, p_target_player_id uuid)': 'Host action, proved by the seat token.',
  'restart_room(p_room_id uuid, p_player_id uuid, p_token uuid)': 'Host action, proved by the seat token.',
  'start_room(p_room_id uuid, p_player_id uuid, p_token uuid, p_round_refs jsonb, p_answer_keys jsonb)': 'Host action, proved by the seat token.',
  'submit_answer(p_room_id uuid, p_player_id uuid, p_token uuid, p_answer text)': 'Own seat only; returns no correctness signal.',
  'update_room_settings(p_room_id uuid, p_player_id uuid, p_token uuid, p_mode text, p_settings jsonb)': 'Host action, proved by the seat token.',
  'register_room_scores(p_room_id uuid, p_player_id uuid, p_token uuid, p_avatars jsonb)': 'Any seat may register; values come from the server, avatars are validated against the row own id.',
  'room_answers_for(p_room_id uuid, p_index integer)': 'Discloses nothing for a question still in play.',
  'tick_room(p_room_id uuid)': 'Advances the clock only once question_ends_at has passed.',
  'heartbeat(p_player text, p_discord_id text, p_guild_id text, p_channel_id text, p_mode text, p_activity text, p_platform text)': 'Presence upsert, length-bounded and name-checked.',
  'record_progress(p_player text, p_seconds integer, p_multiplayer boolean, p_won boolean, p_xp integer, p_perfect boolean)': 'Unauthenticated arity for Electron; cannot supply a discord id.',
  'is_safe_player_name(p_name text)': 'Pure predicate the client mirrors for instant feedback.',
  'gtl_level_from_xp(p_xp bigint)': 'Pure arithmetic.'
};

// The explicit column grant on rooms. `code` lets a stranger join;
// discord_instance_id was half of the seat-takeover pair.
const EXPECTED_ROOMS_COLUMNS = [
  'created_at', 'finished_at', 'host_player_id', 'id', 'mode', 'phase',
  'question_ends_at', 'question_index', 'round_refs', 'settings', 'status'
];

/* The apply-order list is hand-maintained, so it goes stale exactly like the
   schema files it exists to read. An unlisted migration falls back to the
   alphabetical tie-break, which quietly produces a wrong answer instead of an
   error — the failure mode this whole script is here to prevent. So the script
   checks its own list. */
function checkApplyOrderIsComplete() {
  const listed = new Set(
    [...fs.readFileSync(__filename, 'utf-8').matchAll(/'(migration-[a-z0-9-]+\.sql)'/g)].map((m) => m[1])
  );
  const missing = fs.readdirSync(SQL_DIR)
    .filter((f) => f.startsWith('migration-') && f.endsWith('.sql') && !listed.has(f));
  if (!missing.length) return 0;
  console.log(`\n${missing.length} migration file(s) missing from applyOrder():\n`);
  for (const f of missing) {
    console.log(`  ${f}\n      Add it to the \`applied\` list in apply order, or this file is sorted`
      + '\n      alphabetically and a function it replaces may be read from the wrong one.\n');
  }
  return 1;
}

function checkSecurity() {
  if (!fs.existsSync(SECURITY_SNAPSHOT)) {
    console.log('No scripts/prod-security.json - run supabase/snapshot.sql and save it there.');
    return 1;
  }
  const snap = JSON.parse(fs.readFileSync(SECURITY_SNAPSHOT, 'utf-8'));
  const bad = [];

  for (const t of snap.tablesWithoutRls || []) {
    bad.push(['table ' + t + ' has RLS DISABLED',
      'Every table must have it; the ensure_rls trigger sets it on creation.']);
  }

  for (const w of snap.anonWritePolicies || []) {
    if (!ALLOWED_ANON_WRITES[w]) {
      bad.push(['anon can write: ' + w,
        'Not on the allowlist. Add it to ALLOWED_ANON_WRITES with the reason it is safe, or drop the policy.']);
    }
  }

  for (const f of snap.anonExecutableFunctions || []) {
    const name = f.split('(')[0];
    if (FOREIGN.has(name.toLowerCase())) continue;
    if (name.startsWith('_')) {
      bad.push(['anon can call the internal helper ' + f,
        'Underscore-prefixed functions are helpers. _answer_for_index handed out the answer key exactly this way.']);
      continue;
    }
    if (name.startsWith('admin_')) {
      bad.push(['anon can call ' + f, 'admin_* functions are service_role only.']);
      continue;
    }
    if (!ALLOWED_ANON_FUNCTIONS[f]) {
      bad.push(['anon can call ' + f,
        'Not on the allowlist. Add it to ALLOWED_ANON_FUNCTIONS with the reason, or revoke it.']);
    }
  }

  const rooms = (snap.roomsColumnsAnonMayRead || []).slice().sort();
  for (const c of rooms.filter((x) => !EXPECTED_ROOMS_COLUMNS.includes(x))) {
    bad.push(['anon can read rooms.' + c,
      c === 'code' ? 'The room code lets a stranger join a room.'
        : c === 'discord_instance_id' ? 'Half of the seat-takeover pair.'
          : 'Not part of the expected column grant.']);
  }
  const missing = EXPECTED_ROOMS_COLUMNS.filter((c) => !rooms.includes(c));
  if (missing.length) {
    bad.push(['rooms columns anon can NO LONGER read: ' + missing.join(', '),
      'ROOM_COLUMNS in src/multiplayer.js names these; a missing one fails the whole select with "permission denied for table rooms".']);
  }

  if (!bad.length) {
    console.log('Security posture OK: ' + (snap.anonWritePolicies || []).length
      + ' anon write policies, ' + (snap.anonExecutableFunctions || []).length
      + ' anon-callable functions, all accounted for.');
    console.log('  (snapshot pulled ' + (snap._pulledAt || 'at an unrecorded time')
      + ' - re-run supabase/snapshot.sql after any policy or grant change)');
    return 0;
  }
  console.log('\n' + bad.length + ' security finding(s):\n');
  for (const [what, why] of bad) console.log('  ' + what + '\n      ' + why + '\n');
  return 1;
}

process.exit(main() | checkApplyOrderIsComplete() | checkSecurity());
