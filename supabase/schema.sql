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

drop policy if exists "public can insert scores" on public.scores;
create policy "public can insert scores"
  on public.scores for insert
  with check (score >= 0 and public.is_safe_player_name(player));

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
create table if not exists public.player_stats (
  player      text primary key,
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

create or replace function public.record_play(
  p_player  text,
  p_seconds integer,
  p_multiplayer boolean default false,
  p_won boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  name text := left(btrim(coalesce(p_player, '')), 32);
  secs integer := greatest(0, least(coalesce(p_seconds, 0), 86400));
begin
  if name = '' then return; end if;
  insert into public.player_stats (player, games, mp_games, wins, seconds, last_seen)
  values (name, 1,
    case when p_multiplayer then 1 else 0 end,
    case when p_multiplayer and p_won then 1 else 0 end,
    secs, now())
  on conflict (player) do update set
    games    = public.player_stats.games + 1,
    mp_games = public.player_stats.mp_games + case when p_multiplayer then 1 else 0 end,
    wins     = public.player_stats.wins + case when p_multiplayer and p_won then 1 else 0 end,
    seconds  = public.player_stats.seconds + secs,
    last_seen = now();
end;
$$;

grant execute on function public.record_play(text, integer, boolean, boolean) to anon, authenticated;

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
