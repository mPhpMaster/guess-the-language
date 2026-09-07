-- ===========================================================================
-- Guess the Programming Language — Supabase leaderboard schema
-- Run this in the Supabase dashboard SQL editor (SQL -> New query -> Run).
-- ===========================================================================

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  player      text not null check (char_length(player) between 1 and 24),
  score       integer not null check (score >= 0),
  mode        text not null default 'languages',
  multiplayer boolean not null default false,
  avatar      text,
  created_at  timestamptz not null default now()
);

-- If upgrading an existing table, add the per-mode + multiplayer + avatar columns:
alter table public.scores add column if not exists mode text not null default 'languages';
alter table public.scores add column if not exists multiplayer boolean not null default false;
-- Profile photo URL (e.g. Discord avatar) shown on the leaderboard; nullable.
alter table public.scores add column if not exists avatar text;

-- Index to make per-mode "top scores" queries fast.
create index if not exists scores_mode_score_idx on public.scores (mode, score desc);

-- Shared server-side display-name safety check. The client mirrors this for
-- immediate feedback, but this function is the authoritative insert guard.
create or replace function public.is_safe_player_name(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_name is not null
    and char_length(btrim(p_name)) between 1 and 24
    and regexp_replace(
      translate(lower(p_name), '043@ᶠᶸᶜᵏᵧₒᵤˢʰⁱᵗᵇⁿᵍʷʳᵖᵉˣᴜγ', 'oaeafuckyoushitbngwrpexuy'),
      '[[:space:]_.-]+', '', 'g'
    )
      !~ '(fuck|fuk|shit|bitch|cunt|nigg|whore|porn|sex|نيك|كس|قحبة|شرموط|زب)';
$$;

grant execute on function public.is_safe_player_name(text) to anon, authenticated;

-- NOT VALID leaves historical rows untouched while still enforcing the check
-- for every new or updated score.
alter table public.scores drop constraint if exists scores_safe_player_name;
alter table public.scores
  add constraint scores_safe_player_name
  check (public.is_safe_player_name(player)) not valid;

-- Row Level Security: a public game leaderboard allows anyone (the anon key)
-- to read all scores and to insert their own. No update/delete is granted.
alter table public.scores enable row level security;

drop policy if exists "public can read scores" on public.scores;
create policy "public can read scores"
  on public.scores for select
  using (true);

-- Inserts are bounded by what the game can arithmetically produce in one round
-- (20 questions x 1050 = 21000; see supabase/migration-score-integrity.sql for the
-- derivation). The client goes through /api/submit-score, which verifies a signed
-- Discord session — but this check is what stops someone POSTing with the public
-- anon key directly, so the bound has to live here as well.
-- See supabase/migration-anon-score-bounds.sql for why each clause is here.
-- This is the only anon write path left to the board and it serves one caller:
-- the Electron desktop build, which has no /api and no session token.
drop policy if exists "public can insert scores" on public.scores;
create policy "public can insert scores"
  on public.scores for insert
  with check (
    score >= 0
    and score <= 21000
    and public.is_safe_player_name(player)
    -- Multiplayer rows come from register_room_scores(), which is SECURITY
    -- DEFINER and so bypasses this policy. anon has no reason to set the flag.
    and multiplayer = false
    and mode in ('languages','cybersecurity','devops','network','gamedev','algorithms','all')
    -- The player's own Discord photo or nothing, as safeAvatar() enforces in
    -- /api/submit-score.
    and (avatar is null or (avatar like 'https://cdn.discordapp.com/avatars/%'
                            and char_length(avatar) <= 300))
  );

-- Player reports are written only through /api/report with the service-role
-- key. There is deliberately no anon/authenticated select or insert policy.
create table if not exists public.leaderboard_reports (
  id                  bigint generated always as identity primary key,
  score_id            bigint not null references public.scores(id) on delete cascade,
  reporter_discord_id text not null check (char_length(reporter_discord_id) between 1 and 32),
  reason              text not null check (reason in ('offensive_name', 'impersonation', 'spam_other')),
  details             text check (details is null or char_length(details) <= 250),
  created_at          timestamptz not null default now(),
  unique (score_id, reporter_discord_id)
);

create index if not exists leaderboard_reports_created_idx
  on public.leaderboard_reports (created_at desc);

alter table public.leaderboard_reports enable row level security;

-- NOTE: anon inserts are inherently spoofable from a client. For a casual
-- leaderboard this is fine. To harden against cheating, move score submission
-- behind an Edge Function / your own backend that validates the run, and
-- remove the public insert policy above.

-- Multiplayer rooms: run supabase/schema-multiplayer.sql in the same SQL editor.

-- ---------------------------------------------------------------------------
-- Player activity stats (v3.4.1): hours played, multiplayer games + wins,
-- last activity. Written only through record_play(); read publicly for profiles.
-- ---------------------------------------------------------------------------
-- The primary key is a surrogate `id`, added in migration-identity-step-c.sql;
-- `player` is NOT unique any more. Two Discord identities may hold the same
-- display name — one having renamed away from it, another having taken it — and
-- the partial uniques there keep claimed and unclaimed rows apart.
create table if not exists public.player_stats (
  player      text not null,
  games       integer not null default 0,
  mp_games    integer not null default 0,
  wins        integer not null default 0,
  seconds     bigint  not null default 0,
  last_seen   timestamptz not null default now()
);

alter table public.player_stats enable row level security;

drop policy if exists "public can read player_stats" on public.player_stats;
create policy "public can read player_stats"
  on public.player_stats for select using (true);

-- record_play() lived here. It was superseded by record_progress() in v3.6.0,
-- had no caller left, and upserted with `on conflict (player)` — which stops
-- resolving once `player` is not a unique key. Dropped in
-- migration-identity-step-c.sql.

-- ---------------------------------------------------------------------------
-- Client error logging. The web / Discord / desktop clients write uncaught
-- errors, unhandled rejections and console.error output here (best-effort, via
-- the anon key). Reads are service-role only — no SELECT policy — so error
-- contents are not publicly readable. See logError() in src/renderer.js.
-- ---------------------------------------------------------------------------
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null default 'error',
  source text,
  message text not null,
  stack text,
  app_version text,
  platform text,
  player text,
  url text,
  context jsonb not null default '{}'::jsonb
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

drop policy if exists error_logs_insert_anon on public.error_logs;
create policy error_logs_insert_anon on public.error_logs
  for insert to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Phase 2 progression: XP / levels, daily streak, perfect games, achievements.
-- record_progress() supersedes record_play(): it does everything record_play did
-- plus awards XP, recomputes level & daily streak, and unlocks achievements —
-- returning the new level/xp/streak and any achievements unlocked this call.
-- ---------------------------------------------------------------------------
alter table public.player_stats
  add column if not exists xp bigint not null default 0,
  add column if not exists level int not null default 1,
  add column if not exists day_streak int not null default 0,
  add column if not exists best_day_streak int not null default 0,
  add column if not exists last_play_date date,
  add column if not exists perfect_games int not null default 0,
  add column if not exists achievements jsonb not null default '[]'::jsonb;

create or replace function public.gtl_level_from_xp(p_xp bigint)
returns int language sql immutable as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0) / 1000.0))::int + 1);
$$;

-- record_progress(): supersedes record_play(). Upserts player_stats, awards XP,
-- recomputes level and daily streak, unlocks achievements, and returns
--   { level, xp, day_streak, best_day_streak, new_achievements: [...] }
--
-- This body was RECOVERED FROM PRODUCTION. The file previously said only "full
-- body lives in migration phase2_progression_fix" — a migration that is not in
-- this repo — so the most security-sensitive function the anon key can call had
-- no definition under version control at all. Anyone reading this file to plan a
-- change was reading a pointer to nothing. Recovered via scripts/schema-drift.js;
-- verified byte-identical to the deployed definition at v3.23.0.
--
-- Note the trust model, unchanged and worth being explicit about: p_player is a
-- self-asserted display name, so anyone holding the anon key can add XP to any
-- name. That is the same exposure as `scores` and closing it means finishing the
-- discord_id migration in supabase/migration-score-integrity.sql, not patching
-- this function.
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
      -- overwrite a different id: rows are keyed by a display name, and a freed
      -- name can be taken by someone else, so overwriting would let whoever
      -- plays next silently inherit an established profile.
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

-- Only /api/record-progress, which verifies the session, may supply an id.
revoke all on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_progress(text, integer, boolean, boolean, integer, boolean, text)
  to service_role;

-- The unauthenticated path, unchanged in behaviour: delegate with no id. Kept
-- granted to anon because the Electron desktop build has no /api to call and no
-- session token, and refusing to record a round already played would remove a
-- working feature to gain nothing.
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
-- RLS safety net.
--
-- RECOVERED FROM PRODUCTION, where it already runs as the `ensure_rls` event
-- trigger. Provenance unknown — it predates this audit and may have been added
-- from the dashboard — but it is load-bearing and was nowhere in this repo, so a
-- fresh install would silently lack it. It turns RLS on for every new table in
-- `public`, which is why a forgotten `alter table ... enable row level security`
-- has never yet become an open table here.
--
-- Do NOT treat it as a substitute for writing the policy. RLS on with no policy
-- denies everything: safe, but it surfaces as a feature that mysteriously
-- returns empty rather than as an obvious permissions error. (Exactly that shape
-- shows up in test/probe-anon-surface.js, where error_logs / presence /
-- banned_players answer 200 with [] rather than 401.)
--
-- Creating an event trigger needs elevated rights; on a fresh project run this
-- as the `postgres` role in the SQL editor.
-- ---------------------------------------------------------------------------
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (system schema or not in enforced list: %.)',
        cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end $$;

-- Never callable as an RPC: it returns event_trigger, which PostgREST cannot
-- even render, and Postgres grants EXECUTE to PUBLIC by default.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Daily Challenge (Phase 3): the same 10 questions for everyone each UTC day
-- (chosen deterministically client-side from a date seed — see buildDailyRound in
-- renderer.js). One score per player per day; the first submission stands.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_scores (
  id bigint generated always as identity primary key,
  day date not null,
  player text not null check (char_length(player) >= 1 and char_length(player) <= 24),
  score int not null check (score >= 0),
  avatar text,
  created_at timestamptz not null default now(),
  unique (day, player)
);
create index if not exists daily_scores_day_score_idx on public.daily_scores (day, score desc);

alter table public.daily_scores enable row level security;

drop policy if exists daily_scores_select_all on public.daily_scores;
create policy daily_scores_select_all on public.daily_scores for select to anon, authenticated using (true);

-- First score of the day stands: the client POSTs with Prefer resolution=ignore-duplicates
-- so a replay is a silent no-op. Inserts limited to today/yesterday (UTC) to block backfill.
drop policy if exists daily_scores_insert_today on public.daily_scores;
create policy daily_scores_insert_today on public.daily_scores
  for insert to anon, authenticated
  with check (day <= (now() at time zone 'utc')::date and day >= (now() at time zone 'utc')::date - 1);

-- ---------------------------------------------------------------------------
-- Friends / following (Phase 6.3). Names are self-asserted throughout the game
-- (same trust model as scores), so follow/unfollow/read are open to the anon key.
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower text not null check (char_length(follower) >= 1 and char_length(follower) <= 24),
  followee text not null check (char_length(followee) >= 1 and char_length(followee) <= 24),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_follower_idx on public.follows (follower);
alter table public.follows enable row level security;
drop policy if exists follows_all on public.follows;
create policy follows_all on public.follows for all to anon, authenticated using (true) with check (true);
