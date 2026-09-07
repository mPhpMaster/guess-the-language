-- ===========================================================================
-- Take TRUNCATE away from the public roles.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- No client release needed, no cutover: PostgREST never emits TRUNCATE, and no
-- function in this database contains the word (verified against pg_get_functiondef
-- across the whole public schema before writing this). Nothing legitimate loses
-- anything.
--
-- ---------------------------------------------------------------------------
-- Why it matters
-- ---------------------------------------------------------------------------
-- Supabase's default grant is `arwdDxtm` to anon and authenticated. The `D` is
-- TRUNCATE, and it was held on all 19 public tables — including the ones whose
-- RLS was carefully written to bound what anon may write.
--
-- The point is that TRUNCATE does not consult RLS at all. A DELETE policy that
-- says `using (...)` is simply not consulted; the table empties. So every write
-- bound added in migration-anon-write-bounds.sql sat next to a verb that
-- ignores all of them.
--
-- This is NOT currently exploitable: TRUNCATE is not something PostgREST can be
-- persuaded to issue — it speaks SELECT/INSERT/UPDATE/DELETE and RPC, and no RPC
-- truncates. It is a latent over-grant, one careless `security definer` helper
-- away from being real. Removing it costs nothing, so there is no reason to keep
-- carrying it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Existing tables
-- ---------------------------------------------------------------------------
-- NOTE: this schema also holds tables belonging to another app in the same
-- project (conversations, messages, profiles, user_roles, bank_data,
-- trainer_board). They are included deliberately — the reasoning above is not
-- specific to the game, and no app reaches TRUNCATE through the anon key. If
-- that app ever grows a service that needs it, it should hold service_role,
-- which is untouched here.
revoke truncate on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Future tables
-- ---------------------------------------------------------------------------
-- Without this the fix decays: the next `create table` in this schema hands
-- TRUNCATE straight back, because the default ACL still says arwdDxtm.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- The same default ACL exists for the `supabase_admin` role and is DELIBERATELY
-- left alone. That is Supabase's own platform role, used by their tooling to
-- create internal objects; narrowing it risks surprising machinery this project
-- does not own. The role that creates this project's tables is `postgres`, which
-- the statement above covers. If a table ever shows up with TRUNCATE granted
-- again, check who created it before assuming this migration failed.

-- ---------------------------------------------------------------------------
-- Not done here, on purpose
-- ---------------------------------------------------------------------------
-- The same default grant also hands anon REFERENCES (x) and TRIGGER (t). Both
-- are DDL-only privileges — you need CREATE rights to use either, which anon
-- does not have — so they are a tidier-looking over-grant rather than a
-- meaningful one, and they are outside what was asked for here. Worth folding
-- into a later pass; not worth widening this one.
