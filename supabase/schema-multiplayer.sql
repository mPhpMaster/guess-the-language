-- ===========================================================================
-- Guess the Language — Multiplayer rooms (run after schema.sql)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (char_length(code) = 4),
  host_player_id     uuid,
  mode               text not null,
  settings           jsonb not null default '{}'::jsonb,
  status             text not null default 'lobby'
                     check (status in ('lobby', 'playing', 'finished')),
  question_index     int not null default 0 check (question_index >= 0),
  phase              text not null default 'question'
                     check (phase in ('question', 'reveal')),
  question_ends_at   timestamptz,
  round_refs         jsonb,
  created_at         timestamptz not null default now()
);

create table if not exists public.room_players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  score      int not null default 0 check (score >= 0),
  correct    int not null default 0 check (correct >= 0),
  streak     int not null default 0 check (streak >= 0),
  is_host    boolean not null default false,
  spectator  boolean not null default false,
  joined_at  timestamptz not null default now()
);

-- Players who joined a room mid-game watch only (see join_discord_room).
alter table public.room_players
  add column if not exists spectator boolean not null default false;

create index if not exists room_players_room_id_idx on public.room_players (room_id);

alter table public.rooms
  drop constraint if exists rooms_host_player_fk;

alter table public.rooms
  add constraint rooms_host_player_fk
  foreign key (host_player_id) references public.room_players(id) on delete set null;

create table if not exists public.room_answers (
  room_id          uuid not null references public.rooms(id) on delete cascade,
  player_id        uuid not null references public.room_players(id) on delete cascade,
  question_index   int not null check (question_index >= 0),
  answer           text not null,
  time_left        int not null default 0 check (time_left >= 0),
  points           int not null default 0,
  is_correct       boolean not null default false,
  submitted_at     timestamptz not null default now(),
  primary key (room_id, player_id, question_index)
);

create table if not exists public.room_answer_keys (
  room_id   uuid primary key references public.rooms(id) on delete cascade,
  answers   jsonb not null
);

-- Backfill columns for existing deployments (idempotent).
-- finished_at: when a game ended, so finished rooms can linger for "play again".
-- color/icon: each player's distinct identity (assigned at create/join).
alter table public.rooms add column if not exists finished_at timestamptz;
alter table public.room_players add column if not exists color text;
alter table public.room_players add column if not exists icon text;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_answers enable row level security;
alter table public.room_answer_keys enable row level security;

drop policy if exists "public read rooms" on public.rooms;
create policy "public read rooms"
  on public.rooms for select using (true);

drop policy if exists "public read room_players" on public.room_players;
create policy "public read room_players"
  on public.room_players for select using (true);

drop policy if exists "public read room_answers" on public.room_answers;
create policy "public read room_answers"
  on public.room_answers for select using (true);

-- room_answer_keys: no public read (answers only via SECURITY DEFINER RPCs)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._gen_room_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i int;
begin
  for i in 1..4 loop
    out_code := out_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return out_code;
end;
$$;

create or replace function public._assert_admin(p_room_id uuid, p_player_id uuid)
returns public.rooms
language plpgsql
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if r.host_player_id is distinct from p_player_id then
    raise exception 'Admin access required';
  end if;
  return r;
end;
$$;

create or replace function public._duration_for_difficulty(p_difficulty text)
returns int
language sql
immutable
as $$
  select case p_difficulty
    when 'hard' then 12
    when 'medium' then 14
    else 15
  end;
$$;

create or replace function public._score_points(p_time_left int, p_streak_after int)
returns int
language sql
immutable
as $$
  select round((100 + 10 * greatest(p_time_left, 0)) *
    case when p_streak_after >= 3 then 1.5 else 1.0 end);
$$;

-- Distinct colour + icon per player, picked round-robin by join slot so the
-- first dozen players in a room are always visually unique.
create or replace function public._player_color(slot int)
returns text
language sql
immutable
as $$
  select (array['#2ec5ff','#19f0c4','#ffd874','#ff7a9c','#b18cff','#5fd0ff',
                '#25d07d','#ff9f5a','#f78fff','#8cff6b','#ff5470','#74e0ff'])
         [1 + (greatest(slot, 0) % 12)];
$$;

create or replace function public._player_icon(slot int)
returns text
language sql
immutable
as $$
  select (array['🦊','🐼','🦉','🐙','🦁','🐯','🐧','🐸','🦄','🐢','🦅','🐲'])
         [1 + (greatest(slot, 0) % 12)];
$$;

create or replace function public._answer_for_index(p_room_id uuid, p_index int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  arr jsonb;
  elem jsonb;
begin
  select answers into arr from public.room_answer_keys where room_id = p_room_id;
  if arr is null then
    raise exception 'Answer key missing';
  end if;
  select value into elem
  from jsonb_array_elements(arr) as value
  where (value->>'index')::int = p_index
  limit 1;
  if elem is null then
    raise exception 'Answer not found for question';
  end if;
  return elem->>'answer';
end;
$$;

create or replace function public._set_question_timer(p_room_id uuid, p_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  refs jsonb;
  ref jsonb;
  dur int;
begin
  select round_refs into refs from public.rooms where id = p_room_id;
  ref := refs -> p_index;
  if ref is null then
    raise exception 'Invalid question index';
  end if;
  dur := coalesce((ref->>'duration')::int, 15);
  update public.rooms
  set question_index = p_index,
      phase = 'question',
      question_ends_at = now() + make_interval(secs => dur)
  where id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_room(
  p_mode text,
  p_settings jsonb,
  p_host_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_code text;
  v_attempts int := 0;
begin
  if char_length(trim(p_host_name)) < 1 or char_length(p_host_name) > 24 then
    raise exception 'Invalid player name';
  end if;

  perform public.cleanup_rooms();

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 30 then
      raise exception 'Could not generate unique room code';
    end if;
    v_code := public._gen_room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, mode, settings)
  values (v_code, p_mode, coalesce(p_settings, '{}'::jsonb))
  returning id into v_room_id;

  insert into public.room_players (room_id, name, is_host, color, icon)
  values (v_room_id, trim(p_host_name), true,
          public._player_color(0), public._player_icon(0))
  returning id into v_player_id;

  update public.rooms set host_player_id = v_player_id where id = v_room_id;

  return jsonb_build_object(
    'roomId', v_room_id,
    'code', v_code,
    'playerId', v_player_id
  );
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_player_id uuid;
  v_slot int;
begin
  if char_length(trim(p_name)) < 1 or char_length(p_name) > 24 then
    raise exception 'Invalid player name';
  end if;

  perform public.cleanup_rooms();

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code));

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

  -- No two concurrent players in the same room may share a name.
  if exists (
    select 1 from public.room_players
    where room_id = v_room.id and lower(trim(name)) = lower(trim(p_name))
  ) then
    raise exception 'Name already taken in this room';
  end if;

  select count(*) into v_slot from public.room_players where room_id = v_room.id;

  insert into public.room_players (room_id, name, is_host, color, icon)
  values (v_room.id, trim(p_name), false,
          public._player_color(v_slot), public._player_icon(v_slot))
  returning id into v_player_id;

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'playerId', v_player_id
  );
end;
$$;

create or replace function public.start_room(
  p_room_id uuid,
  p_player_id uuid,
  p_round_refs jsonb,
  p_answer_keys jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  player_count int;
  result jsonb;
begin
  r := public._assert_admin(p_room_id, p_player_id);

  if r.status <> 'lobby' then
    raise exception 'Room is not in lobby';
  end if;

  -- Everyone present when the round starts plays it (clears any spectator flags
  -- left over from a previous round).
  update public.room_players set spectator = false where room_id = p_room_id;

  -- A single player may start a solo round (e.g. alone in a Discord voice call).
  select count(*) into player_count from public.room_players where room_id = p_room_id;
  if player_count < 1 then
    raise exception 'Need at least 1 player';
  end if;

  if p_round_refs is null or jsonb_array_length(p_round_refs) < 1 then
    raise exception 'Round is empty';
  end if;

  insert into public.room_answer_keys (room_id, answers)
  values (p_room_id, p_answer_keys)
  on conflict (room_id) do update set answers = excluded.answers;

  update public.rooms
  set status = 'playing',
      round_refs = p_round_refs,
      question_index = 0
  where id = p_room_id;

  perform public._set_question_timer(p_room_id, 0);

  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end;
$$;

-- Apply score / correct / streak for every stored answer of one question.
-- Called EXACTLY once, at the question -> reveal transition, so that scores do
-- not change until the question's time is up. Serialised by the room row lock
-- held by whichever RPC performs the transition.
create or replace function public._settle_question(p_room_id uuid, p_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  correct_answer text;
  a record;
  new_streak int;
  pts int;
begin
  correct_answer := public._answer_for_index(p_room_id, p_index);
  for a in
    select ra.player_id, ra.answer, ra.time_left, rp.streak as cur_streak
    from public.room_answers ra
    join public.room_players rp on rp.id = ra.player_id
    where ra.room_id = p_room_id and ra.question_index = p_index
    order by ra.submitted_at
  loop
    if a.answer is not null and trim(a.answer) = trim(correct_answer) then
      new_streak := a.cur_streak + 1;
      pts := public._score_points(greatest(a.time_left, 0), new_streak);
      update public.room_players
      set score = score + pts, correct = correct + 1, streak = new_streak
      where id = a.player_id;
      update public.room_answers
      set points = pts, is_correct = true
      where room_id = p_room_id and player_id = a.player_id and question_index = p_index;
    else
      update public.room_players set streak = 0 where id = a.player_id;
      update public.room_answers
      set points = 0, is_correct = false
      where room_id = p_room_id and player_id = a.player_id and question_index = p_index;
    end if;
  end loop;
end;
$$;

create or replace function public.submit_answer(
  p_room_id uuid,
  p_player_id uuid,
  p_answer text,
  p_time_left int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  correct_answer text;
  is_ok boolean;
  active_players int;
  answered_count int;
  everyone boolean;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if r.status <> 'playing' then raise exception 'Game not in progress'; end if;
  if r.phase <> 'question' then raise exception 'Not accepting answers'; end if;

  if not exists (
    select 1 from public.room_players where id = p_player_id and room_id = p_room_id
  ) then
    raise exception 'Player not in room';
  end if;

  correct_answer := public._answer_for_index(p_room_id, r.question_index);
  is_ok := trim(p_answer) = trim(correct_answer);

  -- Store (or replace) the pick. A player may change their answer as many times
  -- as they like while the question is open; the score is NOT touched here — it
  -- is applied for everyone at the reveal (see _settle_question).
  insert into public.room_answers (room_id, player_id, question_index, answer, time_left, points, is_correct)
  values (p_room_id, p_player_id, r.question_index, p_answer, greatest(p_time_left, 0), 0, is_ok)
  on conflict (room_id, player_id, question_index) do update
    set answer = excluded.answer,
        time_left = excluded.time_left,
        is_correct = excluded.is_correct,
        submitted_at = now();

  -- Everyone has now answered: settle scores and jump to the 2s reveal.
  select count(*) into active_players
  from public.room_players
  where room_id = p_room_id and coalesce(spectator, false) = false;
  select count(*) into answered_count
  from public.room_answers
  where room_id = p_room_id and question_index = r.question_index;
  everyone := active_players > 0 and answered_count >= active_players;

  if everyone then
    update public.rooms
    set phase = 'reveal',
        question_ends_at = now() + interval '2 seconds'
    where id = p_room_id and phase = 'question';
    if found then
      perform public._settle_question(p_room_id, r.question_index);
    end if;
  end if;

  return jsonb_build_object(
    'isCorrect', is_ok,
    'correctAnswer', correct_answer,
    'everyoneAnswered', everyone
  );
end;
$$;

create or replace function public.tick_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  total_questions int;
  active_players int;
  answered_count int;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if r.status <> 'playing' then
    return to_jsonb(r);
  end if;

  select jsonb_array_length(round_refs) into total_questions from public.rooms where id = p_room_id;
  select count(*) into active_players
  from public.room_players
  where room_id = p_room_id and coalesce(spectator, false) = false;
  select count(*) into answered_count
  from public.room_answers
  where room_id = p_room_id and question_index = r.question_index;

  -- Advance early when everyone has answered during question phase.
  if r.phase = 'question' and active_players > 0 and answered_count >= active_players then
    update public.rooms
    set phase = 'reveal',
        question_ends_at = now() + interval '2 seconds'
    where id = p_room_id;
    perform public._settle_question(p_room_id, r.question_index);
    select * into r from public.rooms where id = p_room_id;
    return to_jsonb(r);
  end if;

  if r.question_ends_at is null or now() < r.question_ends_at then
    return to_jsonb(r);
  end if;

  -- The clock ran out during the question: settle scores now and reveal.
  if r.phase = 'question' then
    update public.rooms
    set phase = 'reveal',
        question_ends_at = now() + interval '2 seconds'
    where id = p_room_id;
    perform public._settle_question(p_room_id, r.question_index);
    select * into r from public.rooms where id = p_room_id;
    return to_jsonb(r);
  end if;

  -- reveal -> next question or finish
  if r.question_index + 1 >= total_questions then
    update public.rooms
    set status = 'finished', phase = 'reveal', finished_at = now()
    where id = p_room_id;
  else
    perform public._set_question_timer(p_room_id, r.question_index + 1);
  end if;

  select * into r from public.rooms where id = p_room_id;
  return to_jsonb(r);
end;
$$;

create or replace function public.end_room(
  p_room_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public._assert_admin(p_room_id, p_player_id);
  -- Mark the game finished but KEEP the room so players can hit "Play again"
  -- and return to the lobby. Realtime notifies every client to show the
  -- final scoreboard. Stale finished rooms are reaped by cleanup_rooms.
  update public.rooms
  set status = 'finished', phase = 'reveal',
      finished_at = now(), question_ends_at = null
  where id = p_room_id;
  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end;
$$;

-- Reset a finished room back to its lobby so the same players can replay.
create or replace function public.restart_room(
  p_room_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public._assert_admin(p_room_id, p_player_id);

  delete from public.room_answers where room_id = p_room_id;
  delete from public.room_answer_keys where room_id = p_room_id;

  update public.room_players
  set score = 0, correct = 0, streak = 0
  where room_id = p_room_id;

  update public.rooms
  set status = 'lobby', phase = 'question', question_index = 0,
      round_refs = null, question_ends_at = null, finished_at = null
  where id = p_room_id;

  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end;
$$;

-- Host-only: change the room mode / settings while still in the lobby.
create or replace function public.update_room_settings(
  p_room_id uuid,
  p_player_id uuid,
  p_mode text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  result jsonb;
begin
  r := public._assert_admin(p_room_id, p_player_id);

  if r.status <> 'lobby' then
    raise exception 'Can only change settings in the lobby';
  end if;

  update public.rooms
  set mode = coalesce(nullif(trim(p_mode), ''), mode),
      settings = coalesce(p_settings, settings)
  where id = p_room_id;

  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end;
$$;

-- Delete abandoned / stale rooms ("zombies"). Called opportunistically when
-- anyone creates or joins a room, so no external cron is required.
create or replace function public.cleanup_rooms()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  with del as (
    delete from public.rooms r
    where
      -- finished rooms lingering past a grace window (gives players time to
      -- view the scoreboard and use "Play again" before the room is reaped)
      (r.status = 'finished'
       and coalesce(r.finished_at, r.created_at) < now() - interval '30 minutes')
      -- lobbies that were created but never started
      or (r.status = 'lobby' and r.created_at < now() - interval '2 hours')
      -- games stuck mid-play with no recent activity (host disappeared)
      or (r.status = 'playing'
          and coalesce(r.question_ends_at, r.created_at) < now() - interval '1 hour')
      -- any room left with no players (and old enough to not be mid-creation)
      or (r.created_at < now() - interval '5 minutes'
          and not exists (select 1 from public.room_players p where p.room_id = r.id))
    returning r.id
  )
  select count(*) into deleted_count from del;
  return deleted_count;
end;
$$;

create or replace function public.kick_player(
  p_room_id uuid,
  p_admin_player_id uuid,
  p_target_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  r := public._assert_admin(p_room_id, p_admin_player_id);

  if r.status <> 'lobby' then
    raise exception 'Can only kick in lobby';
  end if;

  if p_target_player_id = p_admin_player_id then
    raise exception 'Cannot kick yourself';
  end if;

  if p_target_player_id = r.host_player_id then
    raise exception 'Cannot kick the admin';
  end if;

  delete from public.room_players
  where id = p_target_player_id and room_id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.leave_room(
  p_room_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', true); end if;

  if r.host_player_id = p_player_id and r.status = 'lobby' then
    delete from public.rooms where id = p_room_id;
    return jsonb_build_object('ok', true, 'roomClosed', true);
  end if;

  delete from public.room_players where id = p_player_id and room_id = p_room_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.rooms replica identity full;
alter table public.room_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'room_players'
  ) then
    alter publication supabase_realtime add table public.room_players;
  end if;
exception
  when undefined_object then
  null;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.rooms, public.room_players, public.room_answers to anon, authenticated;
grant execute on function public.create_room(text, jsonb, text) to anon, authenticated;
grant execute on function public.join_room(text, text) to anon, authenticated;
grant execute on function public.start_room(uuid, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, text, int) to anon, authenticated;
grant execute on function public.tick_room(uuid) to anon, authenticated;
grant execute on function public.end_room(uuid, uuid) to anon, authenticated;
grant execute on function public.restart_room(uuid, uuid) to anon, authenticated;
grant execute on function public.update_room_settings(uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.kick_player(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.leave_room(uuid, uuid) to anon, authenticated;
grant execute on function public.cleanup_rooms() to anon, authenticated;
