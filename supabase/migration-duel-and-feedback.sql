-- v3.40.0 — ranked duels, question feedback, analytics.
--
-- Everything here is written ONLY through the service-role key (api/duel.js,
-- api/questions.js, api/admin.js). Tables get RLS with no anon policies, and the
-- new functions are revoked from PUBLIC/anon/authenticated explicitly — the
-- deny_public_execute event trigger already strips PUBLIC, but stating it keeps
-- this file correct on its own (see supabase/migration-default-deny-execute.sql).
--
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Ranked duel ratings on the existing profile row.
--    player_stats is anon-readable (select using(true)), which is what lets the
--    client draw the rating board directly; ratings are meant to be public.
-- ---------------------------------------------------------------------------
alter table public.player_stats add column if not exists duel_rating integer not null default 1000;
alter table public.player_stats add column if not exists duel_wins   integer not null default 0;
alter table public.player_stats add column if not exists duel_losses integer not null default 0;
alter table public.player_stats add column if not exists duel_draws  integer not null default 0;
create index if not exists player_stats_duel_rating_idx on public.player_stats (duel_rating desc);

-- First time a profile row was created. Existing rows stay NULL (unknown), new
-- rows are stamped — the admin "new players / returning" stats read it.
alter table public.player_stats add column if not exists first_seen timestamptz;
alter table public.player_stats alter column first_seen set default now();

-- Waiting offers: a player hosting a ranked room, waiting for an opponent.
create table if not exists public.duel_queue (
  discord_id  text primary key check (char_length(discord_id) between 1 and 32),
  name        text not null check (char_length(name) between 1 and 24),
  avatar      text check (avatar is null or char_length(avatar) <= 300),
  rating      integer not null default 1000,
  code        text not null check (char_length(code) = 4),
  room_id     uuid not null,
  created_at  timestamptz not null default now()
);
alter table public.duel_queue enable row level security;
revoke all on public.duel_queue from anon, authenticated;

-- One row per rated human duel. room_id as the key makes rating idempotent:
-- both players report the result, only the first insert applies it.
create table if not exists public.duel_results (
  room_id    uuid primary key,
  a_discord  text not null,
  b_discord  text not null,
  a_score    integer not null,
  b_score    integer not null,
  a_before   integer not null,
  a_after    integer not null,
  b_before   integer not null,
  b_after    integer not null,
  created_at timestamptz not null default now()
);
alter table public.duel_results enable row level security;
revoke all on public.duel_results from anon, authenticated;

-- Atomically take the best waiting offer for a searcher: skip their own, skip
-- stale ones, prefer the closest rating among the oldest. FOR UPDATE SKIP LOCKED
-- means two concurrent searchers can never be handed the same room.
create or replace function public.duel_take_offer(p_discord_id text, p_rating integer, p_ttl_seconds integer default 30)
returns setof public.duel_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.duel_queue;
begin
  delete from public.duel_queue where created_at < now() - make_interval(secs => greatest(p_ttl_seconds, 5) * 2);
  select * into v
  from public.duel_queue
  where discord_id <> p_discord_id
    and created_at >= now() - make_interval(secs => greatest(p_ttl_seconds, 5))
  order by abs(rating - coalesce(p_rating, 1000)) <= 200 desc, created_at asc
  limit 1
  for update skip locked;
  if v.discord_id is null then
    return;
  end if;
  delete from public.duel_queue where discord_id = v.discord_id;
  return next v;
end;
$$;
revoke all on function public.duel_take_offer(text, integer, integer) from public, anon, authenticated;
grant execute on function public.duel_take_offer(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Question feedback: reports + per-question answer stats.
-- ---------------------------------------------------------------------------
create table if not exists public.question_reports (
  id                  bigint generated always as identity primary key,
  bank                text not null check (bank in ('languages','cybersecurity','devops','network','gamedev','algorithms','bug','output','sql','regex','git','linux','ai')),
  question_id         integer not null check (question_id > 0),
  reason              text not null check (reason in ('wrong_answer','unclear','typo','duplicate','other')),
  details             text check (details is null or char_length(details) <= 400),
  reporter_discord_id text not null check (char_length(reporter_discord_id) between 1 and 32),
  status              text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  resolved_by         text,
  unique (bank, question_id, reporter_discord_id)
);
create index if not exists question_reports_open_idx on public.question_reports (status, bank, question_id);
alter table public.question_reports enable row level security;
revoke all on public.question_reports from anon, authenticated;

create table if not exists public.question_stats (
  bank        text not null,
  question_id integer not null,
  attempts    integer not null default 0,
  correct     integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (bank, question_id)
);
alter table public.question_stats enable row level security;
revoke all on public.question_stats from anon, authenticated;

-- p_answers: [{bank, id, correct}], already validated by api/questions.js.
create or replace function public.record_question_answers(p_answers jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.question_stats as s (bank, question_id, attempts, correct, updated_at)
  select a->>'bank', (a->>'id')::int, 1, case when (a->>'correct')::boolean then 1 else 0 end, now()
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a
  where a ? 'bank' and a ? 'id'
  on conflict (bank, question_id) do update
    set attempts = s.attempts + excluded.attempts,
        correct = s.correct + excluded.correct,
        updated_at = now();
$$;
revoke all on function public.record_question_answers(jsonb) from public, anon, authenticated;
grant execute on function public.record_question_answers(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Admin analytics — one call for the Stats tab.
-- ---------------------------------------------------------------------------
create or replace function public.admin_analytics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'players_total', (select count(*) from public.player_stats),
    'active_1d',  (select count(*) from public.player_stats where last_seen >= now() - interval '1 day'),
    'active_7d',  (select count(*) from public.player_stats where last_seen >= now() - interval '7 days'),
    'active_30d', (select count(*) from public.player_stats where last_seen >= now() - interval '30 days'),
    'new_7d',     (select count(*) from public.player_stats where first_seen >= now() - interval '7 days'),
    'returning_pct', (
      select case when count(*) = 0 then null
             else round(100.0 * count(*) filter (where last_seen > first_seen + interval '1 day') / count(*))::int end
      from public.player_stats where first_seen is not null and first_seen < now() - interval '1 day'),
    'answers_total', (select coalesce(sum(attempts), 0) from public.question_stats),
    'mode_plays', coalesce((
      select jsonb_agg(jsonb_build_object('mode', mode, 'n', n) order by n desc)
      from (select mode, count(*) n from public.scores
            where created_at >= now() - interval '30 days' group by mode) m), '[]'::jsonb),
    'hardest', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.rate asc)
      from (select bank, question_id, attempts, correct, correct::float / attempts as rate
            from public.question_stats where attempts >= 20
            order by correct::float / attempts asc limit 15) h), '[]'::jsonb),
    'most_reported', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.n desc)
      from (select bank, question_id, count(*) n from public.question_reports
            where status = 'open' group by bank, question_id order by count(*) desc limit 15) r), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_analytics() from public, anon, authenticated;
grant execute on function public.admin_analytics() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Electron's direct score insert (anon) — allow the new topic boards.
--    The style boards (survival/speedrun/hardcore) stay API-only: they need the
--    session-signed path because survival's bound is above 21000.
-- ---------------------------------------------------------------------------
drop policy if exists "public can insert scores" on public.scores;
create policy "public can insert scores"
  on public.scores for insert
  with check (
    score >= 0
    and score <= 21000
    and public.is_safe_player_name(player)
    and multiplayer = false
    and mode in ('languages','cybersecurity','devops','network','gamedev','algorithms',
                 'sql','regex','git','linux','ai','all')
    and (avatar is null or (avatar like 'https://cdn.discordapp.com/avatars/%'
                            and char_length(avatar) <= 300))
  );
