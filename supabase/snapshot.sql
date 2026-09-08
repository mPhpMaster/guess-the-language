-- ===========================================================================
-- Regenerate scripts/prod-security.json.
--
-- Paste into the Supabase SQL editor, run, and save the single returned value
-- over scripts/prod-security.json (keeping the _comment and _pulledAt keys).
-- Then run `node scripts/schema-drift.js`, which holds the result to the
-- invariants encoded there.
--
-- Do this after ANY migration that touches RLS, a policy, or a grant. The
-- checked-in file is a baseline, not a source of truth: it only helps if it is
-- refreshed, and the diff it produces is the review.
--
-- Why a snapshot rather than parsing supabase/*.sql to predict the end state:
-- modelling create/alter/grant/revoke from SQL text well enough to be right is
-- a large job, and a model that is subtly wrong produces false findings — which
-- teaches everyone to skim the report, which is worse than having no report.
-- Reading what production actually has needs no model and cannot be subtly
-- wrong. What it cannot do is notice a change nobody re-ran this for, which is
-- exactly why the invariants in schema-drift.js exist alongside it.
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  -- Every table must have RLS. The ensure_rls event trigger enforces this on
  -- creation; this is the check that it is still true.
  'tablesWithoutRls', coalesce((select jsonb_agg(c.relname order by c.relname)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity), '[]'::jsonb),

  -- The real write surface. A table-level INSERT privilege means nothing on its
  -- own — RLS decides — so this lists tables where anon has BOTH a policy and
  -- the verb. Anything new here needs justifying in schema-drift.js.
  'anonWritePolicies', coalesce((select jsonb_agg(t order by t)
     from (select tablename || ':' || cmd as t from pg_policies
           where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
             and roles::text like '%anon%') y), '[]'::jsonb),

  -- rooms is on an explicit column grant: `code` would let a stranger join a
  -- room, `discord_instance_id` was half of the seat-takeover pair.
  'roomsColumnsAnonMayRead', coalesce((select jsonb_agg(column_name order by column_name)
     from information_schema.column_privileges
     where table_schema='public' and table_name='rooms' and grantee='anon'
       and privilege_type='SELECT'), '[]'::jsonb),

  -- Everything a stranger can call. _answer_for_index sat here once, handing
  -- out the answer key to anyone who asked.
  'anonExecutableFunctions', coalesce((select jsonb_agg(p.proname || '(' ||
       pg_get_function_identity_arguments(p.oid) || ')' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prokind='f'
       and has_function_privilege('anon', p.oid, 'EXECUTE')), '[]'::jsonb)
)) as snapshot;
