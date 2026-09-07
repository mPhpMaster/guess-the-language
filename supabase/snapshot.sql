-- ===========================================================================
-- Production snapshot query — feeds scripts/schema-drift.js
--
-- The files in this directory are hand-maintained and applied by hand, so they
-- drift from the live project silently. That is not a tidiness problem: a
-- migration written against these files failed in production because
-- admin_join_room carried `p_by text DEFAULT NULL` the files never showed
-- ("cannot remove parameter defaults from existing function"). Everyone reads
-- these files before writing SQL, so when they lie the next migration is wrong.
--
-- HOW TO USE
--   1. Paste this into the Supabase SQL editor (project lgpimeppmekfgxpheeqp)
--      and run it.
--   2. Copy the single JSON value it returns into scripts/prod-functions.json.
--   3. node scripts/schema-drift.js
--
-- Signatures, not bodies, on purpose: bodies differ in whitespace and comments
-- for no reason and would bury the real findings, while every drift that has
-- actually bitten here is visible in the signature alone.
-- ===========================================================================

select jsonb_pretty(jsonb_agg(f order by f->>'name'))
from (
  select jsonb_build_object(
           'name',     p.proname,
           -- pg_get_function_arguments includes DEFAULTs; the identity form
           -- does not. The defaults are the whole point, so use this one.
           'args',     pg_get_function_arguments(p.oid),
           'security', case when p.prosecdef then 'definer' else 'invoker' end,
           'anon',     has_function_privilege('anon', p.oid, 'EXECUTE')
         ) as f
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
) s;

-- ---------------------------------------------------------------------------
-- Companion query: grants and policies, for eyeballing after a migration.
-- Not consumed by the script — the drift checker deliberately stays focused on
-- function signatures rather than growing into a half-built pg_dump.
-- ---------------------------------------------------------------------------
-- select table_name, string_agg(distinct privilege_type, '+' order by privilege_type)
-- from information_schema.table_privileges
-- where table_schema='public' and grantee in ('anon','authenticated')
-- group by table_name order by table_name;
--
-- select tablename, policyname, cmd, roles::text
-- from pg_policies where schemaname='public' order by tablename, policyname;
