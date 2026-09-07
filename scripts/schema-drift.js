'use strict';

/* Schema drift detector.
 *
 * The supabase/*.sql files are hand-maintained and applied by hand, so they
 * drift from the live project silently. That is not a tidiness problem: a
 * migration written against the checked-in files failed in production because
 * admin_join_room carried `p_by text DEFAULT NULL` that the files did not show
 * ("cannot remove parameter defaults from existing function"). The files are the
 * thing everyone reads before writing SQL, so when they lie, the next migration
 * is written wrong.
 *
 * This compares the FUNCTION SIGNATURES the repo declares against the ones
 * production actually has. Signatures, not bodies, on purpose: bodies differ in
 * whitespace and comments for no reason and would bury the real findings, while
 * every drift that has actually bitten here — a missing default, a stale
 * parameter list, a function nobody remembered existed — is visible in the
 * signature alone.
 *
 * Usage:
 *   1. Run supabase/snapshot.sql in the Supabase SQL editor.
 *   2. Save the result as scripts/prod-functions.json (an array of
 *      { name, args, security, anon }).
 *   3. node scripts/schema-drift.js
 *
 * Exits non-zero when the repo and production disagree.
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
  // Migrations, in the order they were applied to production.
  const applied = [
    'migration-score-integrity.sql',
    'migration-anon-write-bounds.sql',
    'migration-mp-seat-tokens.sql',
    'migration-discord-join-auth.sql',
    'migration-revoke-truncate.sql'
  ];
  const ia = applied.indexOf(a); const ib = applied.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b); // a new migration nobody listed yet: assume newest
}

function readRepo() {
  const declared = new Map(); // name -> [{ args, file }]
  for (const file of fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort(applyOrder)) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf-8');
    // Drop block and line comments so commented-out DDL is not counted.
    const live = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\n]*$/gm, ' ');
    let m;
    FN_RE.lastIndex = 0;
    while ((m = FN_RE.exec(live)) !== null) {
      const name = m[1].toLowerCase();
      const args = normArgs(m[2]);
      if (!declared.has(name)) declared.set(name, []);
      // Later files/statements win, mirroring apply order: keep them all, the
      // report shows which file each came from.
      declared.get(name).push({ args, file });
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
  const prodByName = new Map(prod.map((f) => [f.name.toLowerCase(), f]));
  const findings = [];

  for (const [name, defs] of declared) {
    const last = defs[defs.length - 1];
    const p = prodByName.get(name);
    if (!p) {
      findings.push([name, 'declared in the repo, ABSENT from production', last.file]);
      continue;
    }
    const repoTypes = typesOf(last.args);
    const prodTypes = typesOf(normArgs(p.args));
    if (repoTypes !== prodTypes) {
      findings.push([name, `signature differs\n      repo: (${repoTypes})\n      prod: (${prodTypes})`, last.file]);
    } else if (hasDefault(normArgs(p.args)) !== hasDefault(last.args)) {
      findings.push([name,
        `parameter defaults differ — this is what breaks CREATE OR REPLACE\n      repo: (${normArgs(last.args)})\n      prod: (${normArgs(p.args)})`,
        last.file]);
    }
  }

  const foreign = [];
  for (const p of prod) {
    const n = p.name.toLowerCase();
    if (declared.has(n)) continue;
    if (FOREIGN.has(n)) { foreign.push(p); continue; }
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

process.exit(main());
