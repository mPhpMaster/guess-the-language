-- ===========================================================================
-- Future functions are closed until explicitly opened.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- Affects only functions created AFTER it runs; every existing grant is left
-- exactly as it is, so nothing that works today stops working.
--
-- ---------------------------------------------------------------------------
-- Why
-- ---------------------------------------------------------------------------
-- migration-revoke-internal-helpers.sql closed eleven functions that were
-- reachable with the public anon key, the worst being _answer_for_index, which
-- is SECURITY DEFINER so that it can read the answer key and duly handed it to
-- anyone who asked. That was clearing a backlog. This is the rule that stops the
-- backlog re-forming: the next helper somebody adds is closed on creation and
-- has to be opened on purpose.
--
-- ---------------------------------------------------------------------------
-- ALTER DEFAULT PRIVILEGES DOES NOT WORK FOR THIS. Measured, not assumed.
-- ---------------------------------------------------------------------------
-- The obvious one-liner is:
--
--   alter default privileges in schema public
--     revoke execute on functions from public, anon, authenticated;
--
-- It was applied to this project and it is not sufficient. Two separate reasons,
-- both worth writing down because the statement *looks* like it worked:
--
-- 1. Stock PostgreSQL grants EXECUTE on a new function to PUBLIC. Supabase does
--    not leave that alone — it adds explicit grants, so the stored default ACL
--    read `postgres=X anon=X authenticated=X service_role=X`, with no PUBLIC
--    entry. Revoking "from public" therefore had nothing to remove.
--
-- 2. After the revoke the stored default ACL correctly read
--    `postgres=X service_role=X` — and a freshly created function still came out
--    as:
--        =X/postgres  postgres=X/postgres  service_role=X/postgres
--    That leading `=X` is the built-in world grant to PUBLIC, re-applied on top
--    of the stored default. anon reaches every new function through it.
--
-- So the default-privileges statement below is kept (it is harmless and removes
-- two redundant explicit grants), but it is NOT the mechanism. The event trigger
-- is.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The mechanism that actually holds
-- ---------------------------------------------------------------------------
-- Same pattern this project already uses to force RLS onto new tables (see
-- rls_auto_enable / the `ensure_rls` trigger in schema.sql): a ddl_command_end
-- event trigger that runs the REVOKE itself.
--
-- It revokes from PUBLIC ONLY, and that restraint is the important part.
-- CREATE OR REPLACE preserves a function's ACL, and every intended-public RPC
-- here holds an EXPLICIT `anon=X` grant — verified across create_room,
-- join_room, submit_answer, tick_room, claim_host, room_answers_for, heartbeat,
-- record_progress, cleanup_rooms, is_safe_player_name and gtl_level_from_xp.
-- Revoking anon/authenticated here as well would therefore strip those grants
-- every time a migration replaced one of them, silently breaking multiplayer on
-- an unrelated edit. Revoking only PUBLIC closes new functions while leaving
-- deliberate grants alone.
--
-- Verified on production, all three cases:
--   new function            -> postgres=X service_role=X, anon denied
--   then an explicit grant  -> anon allowed
--   then CREATE OR REPLACE  -> the anon grant survives
-- ---------------------------------------------------------------------------
create or replace function public.fn_deny_public_execute()
returns event_trigger language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE FUNCTION' and object_type = 'function'
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('revoke execute on function %s from public', cmd.object_identity);
        raise log 'fn_deny_public_execute: closed % to PUBLIC', cmd.object_identity;
      exception
        when others then
          -- Never abort someone's CREATE FUNCTION over this; log and move on.
          raise log 'fn_deny_public_execute: could not close %', cmd.object_identity;
      end;
    end if;
  end loop;
end $$;

revoke all on function public.fn_deny_public_execute() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'deny_public_execute') then
    create event trigger deny_public_execute on ddl_command_end
      when tag in ('CREATE FUNCTION')
      execute function public.fn_deny_public_execute();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What this changes for whoever writes the next function
-- ---------------------------------------------------------------------------
-- Any new RPC the client is meant to call now needs an explicit grant, or it
-- fails with "permission denied for function ..." — a clear error, not a silent
-- one. This repo already grants explicitly for every public RPC, so it costs
-- nothing here:
--
--   create function public.my_new_rpc(p_id uuid) returns jsonb ... ;
--   grant execute on function public.my_new_rpc(uuid) to anon, authenticated;
--
-- NOTE for the other app sharing this project: this applies to your new
-- functions too. Existing ones are untouched; if a new one needs to be callable
-- from the browser, add the grant above.
--
-- service_role is never revoked. That key does not reach a browser, it is what
-- /api/* authenticates with, and closing it would break every server route.
