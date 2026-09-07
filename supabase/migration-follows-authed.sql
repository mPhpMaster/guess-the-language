-- ===========================================================================
-- follows: authenticated writes, and the last unwritten identity column.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp),
-- WITH the release that ships /api/follow. One-way cutover: once the anon write
-- policies are gone an older client's follow button stops working, which is
-- degraded, not broken — reads and the rest of the profile card are unaffected.
--
-- ---------------------------------------------------------------------------
-- Two problems, one cause
-- ---------------------------------------------------------------------------
-- This was the last table written straight from the client with the anon key.
--
-- Identity: follower_discord_id was added by migration-score-integrity.sql and
-- never written by anything, so renaming orphaned an entire follow list. The
-- same "column with no writer" that left player_stats at 0 of 1080.
--
-- Authorisation: the row recorded who was following whom, and nothing checked
-- that the caller was the follower. migration-anon-write-bounds.sql split the
-- original `FOR ALL ... USING (true)` policy and removed UPDATE, but INSERT and
-- DELETE had to stay open, because RLS has no identity to scope to when every
-- caller is `anon`. So anyone could add follows in someone else's name, and a
-- single unfiltered DELETE still emptied the table.
--
-- Both close the same way, and only together: the write moves behind a signed
-- session, so there is finally an identity to attribute AND to scope by.
--
-- ---------------------------------------------------------------------------
-- What this costs
-- ---------------------------------------------------------------------------
-- Callers with no session token — anonymous web and the Electron desktop build
-- — can no longer follow or unfollow. Unlike recording a round already played,
-- there is nothing to preserve here: following is an account-level relationship
-- and an unauthenticated one was never meaningfully anyone's. The client rolls
-- back its optimistic cache update so the button does not lie.
--
-- Reads stay open and name-keyed. followee_discord_id is recorded now, unread,
-- specifically so that switching to id-keyed reads later starts with data
-- instead of starting from zero — which is the whole lesson of step (b).
-- ===========================================================================

alter table public.follows add column if not exists followee_discord_id text;

create index if not exists follows_follower_discord_idx
  on public.follows (follower_discord_id) where follower_discord_id is not null;

-- A follow list is public information and still keyed on display names.
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
  for select to anon, authenticated using (true);

-- No insert or delete policy. /api/follow uses the service-role key, which is
-- not subject to RLS, so it becomes the only writer.
drop policy if exists follows_insert on public.follows;
drop policy if exists follows_delete on public.follows;

-- Belt and braces, the same reasoning as revoking TRUNCATE: a future permissive
-- policy should not be able to re-open the write path on its own.
revoke insert, update, delete on public.follows from anon, authenticated;
