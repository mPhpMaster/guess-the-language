-- ===========================================================================
-- Identity anchoring, step (b) for player_stats: stamp a VERIFIED discord_id.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp), with
-- the release that ships /api/record-progress. Backwards compatible in both
-- directions — see "Cutover" below — so the order does not matter here.
--
-- ---------------------------------------------------------------------------
-- Where the migration actually stands
-- ---------------------------------------------------------------------------
-- migration-score-integrity.sql laid out three steps: (a) add the columns,
-- (b) ship code that stamps them, (c) switch reads over once enough rows carry
-- an id. It warned specifically not to repoint player_stats' primary key until
-- (b) had been live long enough.
--
-- Measured before writing this, (b) is barely happening:
--
--   scores        1183 rows,    7 with discord_id   (0.6%)
--   daily_scores    22 rows,    2 with discord_id
--   player_stats  1080 rows,    0 with discord_id
--   follows         11 rows,    0 with follower_discord_id
--
-- and the newest score with an id was a full day older than the newest score.
-- Rows are still being written unstamped right now.
--
-- The reason is not that the code is broken; it is that only ONE path was ever
-- given the ability. /api/submit-score stamps single-player scores. Nothing else
-- can:
--
--   * record_progress() has no discord_id parameter at all, so player_stats
--     could never be stamped by any caller. Hence 0 of 1080.
--   * multiplayer scores go through submitMpScores(), a direct anon insert —
--     and the "anon cannot set discord_id" policy on `scores` forbids anon from
--     setting the column, so those rows structurally cannot carry one.
--   * follows has no writer for follower_discord_id.
--
-- So step (c) is not blocked on waiting. It is blocked on step (b) being
-- finished. This file does the player_stats half, which is the largest gap and
-- the one that matters most to a player: level, XP, streak and achievements are
-- what a rename currently orphans.
--
-- ---------------------------------------------------------------------------
-- Shape
-- ---------------------------------------------------------------------------
-- Same principle as every other identity fix in this project: the id is not
-- something the caller may assert. It comes from the HMAC-signed session, which
-- only Node can verify, so the stamping overload is reachable only with the
-- service-role key via /api/record-progress.
--
--   record_progress(player, seconds, multiplayer, won, xp, perfect)             -> anon
--   record_progress(player, seconds, multiplayer, won, xp, perfect, discord_id) -> service_role
--
-- Two arities, not one function with a defaulted parameter, precisely so that
-- anon cannot supply the id. A `p_discord_id text default null` would have been
-- tidier to read and trivially forgeable.
--
-- The 6-argument version is kept and still granted to anon because it is a real
-- path, not legacy: the Electron desktop build has no /api to call and no
-- session token, and web players who have not signed in still play. They keep
-- working exactly as before and simply record no id — the same fallback shape
-- submitScore() already uses.
--
-- ---------------------------------------------------------------------------
-- Cutover
-- ---------------------------------------------------------------------------
-- None needed. The 6-argument signature is unchanged, so old clients keep
-- working; the 7-argument one is new, so nothing calls it until the new client
-- ships. Apply before or after the deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The implementation, now taking a verified id.
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

  select * into r from public.player_stats where player = p_player for update;
  if not found then
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
      -- Claim the row for this Discord id only if it is UNCLAIMED. Never
      -- overwrite a different id: these rows are keyed by a display name, and a
      -- name freed by one player can be taken by another, so overwriting would
      -- let whoever plays next silently inherit an established profile. Leaving
      -- the first claim in place keeps the collision visible instead of
      -- resolving it wrongly and quietly. Step (c) has to deal with the
      -- leftovers explicitly rather than inherit a guess.
      discord_id = coalesce(public.player_stats.discord_id, v_did)
    where player = p_player
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
    update public.player_stats set achievements = to_jsonb(v_earned) where player = p_player;
  end if;

  return jsonb_build_object(
    'level', r.level, 'xp', r.xp, 'day_streak', r.day_streak,
    'best_day_streak', r.best_day_streak,
    'new_achievements', to_jsonb(coalesce(v_new, array[]::text[]))
  );
end $$;

-- Only the service role, i.e. only /api/record-progress after it has verified
-- the session. If anon could reach this overload the id would be assertable
-- again and the whole exercise would be theatre.
revoke all on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- The unauthenticated path, unchanged in behaviour: delegate with no id.
-- ---------------------------------------------------------------------------
create or replace function public.record_progress(
  p_player text, p_seconds integer, p_multiplayer boolean,
  p_won boolean, p_xp integer, p_perfect boolean
) returns jsonb
language sql security definer set search_path = public as $$
  select public.record_progress(p_player, p_seconds, p_multiplayer, p_won, p_xp, p_perfect, null);
$$;

grant execute on function public.record_progress(text, integer, boolean, boolean, integer, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- How to watch step (b) fill up. Step (c) — switching reads to prefer
-- discord_id, and repointing this table's primary key — stays blocked until
-- these numbers are high enough that switching does not orphan active players.
-- ---------------------------------------------------------------------------
-- select count(*) filter (where discord_id is not null) as stamped,
--        count(*) as total,
--        round(100.0 * count(*) filter (where discord_id is not null) / nullif(count(*),0), 1) as pct
-- from public.player_stats where last_seen > now() - interval '30 days';
