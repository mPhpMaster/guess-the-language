-- Score integrity + identity anchoring.
--
-- APPLY THIS BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- Every statement is idempotent and additive: no row is rewritten, no column is
-- dropped, and nothing here breaks a client that has not shipped yet. Safe to run
-- on a live database.
--
-- Context: until v3.14.2 the game POSTed single-player scores straight to
-- `scores` with the PUBLIC anon key, and the only insert check was `score >= 0`.
-- Anyone could post any number under any name. The client now goes through
-- /api/submit-score, which verifies an HMAC-signed Discord session and bounds the
-- score — but RLS is what actually stops someone using the anon key directly, so
-- the bound has to live here too.

-- ---------------------------------------------------------------------------
-- 1. Bound what the anon key may insert.
-- ---------------------------------------------------------------------------
-- 21000 is the ceiling the game can arithmetically produce in one round:
--   scoreAnswer() = round((100 + 10 * timeLeft) * multiplier)   [src/modules/round.js]
--   timeLeft <= the question's time; the longest selectable timer is 60s
--   multiplier maxes at 1.5 (streak >= 3)      => per question 1050
--   questions per round tops out at 20         => 20 * 1050 = 21000
-- Raise this if either of those two lists ever grows.
drop policy if exists "public can insert scores" on public.scores;
create policy "public can insert scores"
  on public.scores for insert
  with check (
    score >= 0
    and score <= 21000
    and public.is_safe_player_name(player)
  );

-- The daily board has the same exposure. Its existing date window stays.
drop policy if exists daily_scores_insert_today on public.daily_scores;
create policy daily_scores_insert_today on public.daily_scores
  for insert to anon, authenticated
  with check (
    score >= 0
    and score <= 21000
    and day <= (now() at time zone 'utc')::date
    and day >= (now() at time zone 'utc')::date - 1
  );

-- ---------------------------------------------------------------------------
-- 2. Anchor identity to a Discord id instead of a display name.
-- ---------------------------------------------------------------------------
-- Today `scores.player`, `player_stats.player` and `follows.follower/followee`
-- are all self-asserted display-name strings. Renaming yourself on Discord
-- orphans your level, achievements and follows, and two people can contend for
-- one name over time.
--
-- These columns are nullable and unwritten for now. Historical rows cannot be
-- backfilled — the ids were never recorded — so the sequence has to be:
--   a) run this migration                      (columns exist, nothing writes them)
--   b) ship the code that stamps discord_id     (new rows get it)
--   c) once enough rows carry it, switch reads to prefer discord_id over name
-- Step (c) is a separate change; do not attempt to repoint player_stats' primary
-- key until (b) has been live long enough that active players have a row with an
-- id on it.
alter table public.scores        add column if not exists discord_id text;
alter table public.daily_scores  add column if not exists discord_id text;
alter table public.player_stats  add column if not exists discord_id text;
alter table public.follows       add column if not exists follower_discord_id text;

create index if not exists scores_discord_id_idx       on public.scores (discord_id);
create index if not exists player_stats_discord_id_idx on public.player_stats (discord_id);

-- The anon key must not be able to claim someone else's id. Only the
-- service-role path (/api/submit-score) may set it, so anon inserts must leave
-- it null. Applies on top of the policy in section 1.
drop policy if exists "anon cannot set discord_id" on public.scores;
create policy "anon cannot set discord_id"
  on public.scores as restrictive for insert
  to anon, authenticated
  with check (discord_id is null);
