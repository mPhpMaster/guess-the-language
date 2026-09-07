-- ===========================================================================
-- Identity anchoring, step (c): reads follow the Discord id, not the name.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- No client release required — the RPC signatures do not change — though the
-- profile card gets a small ordering fix in the same release.
--
-- ---------------------------------------------------------------------------
-- The blocker was the design, not the data
-- ---------------------------------------------------------------------------
-- migration-score-integrity.sql said not to repoint this table's primary key
-- "until (b) has been live long enough that active players have a row with an
-- id on it". Read literally that is a wait for ~100% coverage, and coverage is
-- 11 of 1090. On that reading step (c) is years away, or never.
--
-- But the wait is only necessary if the new key REPLACES the old one. It does
-- not have to. A surrogate primary key with two PARTIAL unique indexes lets
-- claimed and unclaimed rows coexist under different rules:
--
--   unique (discord_id) where discord_id is not null   -- one row per identity
--   unique (player)     where discord_id is null       -- legacy rows, as before
--
-- Every one of the 1079 unstamped rows keeps behaving exactly as it does today,
-- keyed by name. A row becomes identity-keyed the moment its owner plays once
-- while signed in. There is no flag day and no coverage threshold.
--
-- ---------------------------------------------------------------------------
-- What this actually buys
-- ---------------------------------------------------------------------------
-- Two things that are broken today:
--
--   Renaming orphans you. record_progress looked your row up by display name,
--   so changing your Discord name started a fresh profile at level 1. Now the
--   lookup is by discord_id first and the row's `player` is updated to your new
--   name, so level, XP, streak and achievements follow the identity.
--
--   A freed name carries the profile with it. Whoever took your old name
--   inherited your row. Now their id finds no row, the name-claim step skips
--   rows already claimed by someone else, and they get a new profile.
--
-- ---------------------------------------------------------------------------
-- The unauthenticated path, and why it is not "fixed"
-- ---------------------------------------------------------------------------
-- The Electron desktop build has no /api and no session, so it can only assert
-- a name. It therefore still resolves by name — preferring an unclaimed row,
-- then the most recently seen claimed one. That means a desktop player can
-- still add XP to whoever currently holds that display name.
--
-- That is not a new hole; it is exactly today's trust level for that client,
-- and the alternative is worse: matching only unclaimed rows would silently
-- split a signed-in player's desktop sessions into a SECOND profile under the
-- same name. Closing it properly means the desktop build getting a session,
-- which is a different piece of work.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. record_play: superseded and now actively in the way.
-- ---------------------------------------------------------------------------
-- record_progress replaced it in v3.6.0 and nothing has called it since
-- (checked across src/ and api/). It upserts with `on conflict (player)`, which
-- stops resolving the moment `player` is no longer a unique key, so it cannot
-- simply be left alone.
drop function if exists public.record_play(text, integer, boolean, boolean);

-- ---------------------------------------------------------------------------
-- 2. Surrogate key + the two partial uniques.
-- ---------------------------------------------------------------------------
alter table public.player_stats add column if not exists id bigint generated always as identity;

alter table public.player_stats drop constraint if exists player_stats_pkey;
alter table public.player_stats add primary key (id);

-- One profile per Discord identity.
drop index if exists public.player_stats_discord_id_key;
create unique index player_stats_discord_id_key
  on public.player_stats (discord_id) where discord_id is not null;

-- Unclaimed rows keep the old guarantee, so nothing about them changes.
drop index if exists public.player_stats_unclaimed_name_key;
create unique index player_stats_unclaimed_name_key
  on public.player_stats (player) where discord_id is null;

-- Name lookups are no longer unique, so they need an index of their own.
create index if not exists player_stats_player_idx on public.player_stats (player);

-- ---------------------------------------------------------------------------
-- 3. record_progress: resolve by identity, fall back to name.
-- ---------------------------------------------------------------------------
create or replace function public.record_progress(
  p_player text, p_seconds integer, p_multiplayer boolean,
  p_won boolean, p_xp integer, p_perfect boolean, p_discord_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  r public.player_stats;
  v_streak int;
  v_xp bigint;
  v_earned text[] := array[]::text[];
  v_existing text[];
  v_new text[];
  v_did text := nullif(btrim(coalesce(p_discord_id, '')), '');
begin
  if p_player is null or length(btrim(p_player)) = 0 then return '{}'::jsonb; end if;

  if v_did is not null then
    -- This identity's profile, whatever it is called now.
    select * into r from public.player_stats where discord_id = v_did for update;

    if not found then
      -- First authenticated play: adopt an existing row for this name, but only
      -- if nobody else has claimed it. A row already belonging to another id is
      -- left alone, which is what stops a freed name carrying a profile.
      select * into r from public.player_stats
      where player = p_player and discord_id is null for update;
    end if;
  else
    -- No proof of identity. Resolve by name as before, preferring an unclaimed
    -- row so a desktop session does not fork a signed-in player into a second
    -- profile under the same name.
    select * into r from public.player_stats
    where player = p_player
    order by (discord_id is null) desc, last_seen desc
    limit 1 for update;
  end if;

  if r.id is null then
    v_streak := 1;
    v_xp := greatest(p_xp, 0);
    insert into public.player_stats(player, games, mp_games, wins, seconds, last_seen,
      xp, level, day_streak, best_day_streak, last_play_date, perfect_games, achievements,
      discord_id)
    values (p_player, 1, case when p_multiplayer then 1 else 0 end, case when p_won then 1 else 0 end,
      greatest(p_seconds, 0), now(), v_xp, gtl_level_from_xp(v_xp), v_streak, v_streak, v_today,
      case when p_perfect then 1 else 0 end, '[]'::jsonb, v_did)
    returning * into r;
  else
    if r.last_play_date = v_today then v_streak := r.day_streak;
    elsif r.last_play_date = v_today - 1 then v_streak := r.day_streak + 1;
    else v_streak := 1; end if;
    v_xp := r.xp + greatest(p_xp, 0);
    update public.player_stats set
      -- Carry the display name forward for an authenticated caller: this is the
      -- line that makes a rename keep your level instead of starting over.
      player = case when v_did is not null then p_player else player end,
      games = r.games + 1,
      mp_games = r.mp_games + case when p_multiplayer then 1 else 0 end,
      wins = r.wins + case when p_won then 1 else 0 end,
      seconds = r.seconds + greatest(p_seconds, 0),
      last_seen = now(),
      xp = v_xp,
      level = gtl_level_from_xp(v_xp),
      day_streak = v_streak,
      best_day_streak = greatest(r.best_day_streak, v_streak),
      last_play_date = v_today,
      perfect_games = r.perfect_games + case when p_perfect then 1 else 0 end,
      -- Claim only if unclaimed; never take a row from another id.
      discord_id = coalesce(public.player_stats.discord_id, v_did)
    where id = r.id
    returning * into r;
  end if;

  if r.games >= 1   then v_earned := array_append(v_earned, 'rookie'); end if;
  if r.games >= 25  then v_earned := array_append(v_earned, 'dedicated'); end if;
  if r.games >= 100 then v_earned := array_append(v_earned, 'centurion'); end if;
  if r.wins >= 1    then v_earned := array_append(v_earned, 'first_win'); end if;
  if r.wins >= 10   then v_earned := array_append(v_earned, 'champion'); end if;
  if r.perfect_games >= 1 then v_earned := array_append(v_earned, 'perfect'); end if;
  if r.perfect_games >= 5 then v_earned := array_append(v_earned, 'flawless'); end if;
  if r.best_day_streak >= 3 then v_earned := array_append(v_earned, 'streak3'); end if;
  if r.best_day_streak >= 7 then v_earned := array_append(v_earned, 'streak7'); end if;
  if r.seconds >= 3600 then v_earned := array_append(v_earned, 'marathon'); end if;
  if r.level >= 5   then v_earned := array_append(v_earned, 'level5'); end if;
  if r.level >= 10  then v_earned := array_append(v_earned, 'level10'); end if;

  select coalesce(array_agg(x), array[]::text[]) into v_existing from jsonb_array_elements_text(r.achievements) x;
  select coalesce(array_agg(e), array[]::text[]) into v_new from unnest(v_earned) e where e <> all(v_existing);
  if array_length(v_new, 1) is not null then
    update public.player_stats set achievements = to_jsonb(v_earned) where id = r.id;
  end if;

  return jsonb_build_object(
    'level', r.level, 'xp', r.xp, 'day_streak', r.day_streak,
    'best_day_streak', r.best_day_streak,
    'new_achievements', to_jsonb(coalesce(v_new, array[]::text[]))
  );
end $$;

revoke all on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  to service_role;
