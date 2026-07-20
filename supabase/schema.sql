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
  with check (score >= 0 and char_length(player) between 1 and 24);

-- NOTE: anon inserts are inherently spoofable from a client. For a casual
-- leaderboard this is fine. To harden against cheating, move score submission
-- behind an Edge Function / your own backend that validates the run, and
-- remove the public insert policy above.

-- Multiplayer rooms: run supabase/schema-multiplayer.sql in the same SQL editor.
