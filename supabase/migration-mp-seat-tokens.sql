-- ===========================================================================
-- Multiplayer seat tokens — close the room-takeover and answer-leak holes.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp), in
-- the SAME release as the client that passes the token. This is a HARD CUTOVER:
-- the old function signatures are dropped, so a client running older code gets
-- "function does not exist" until it reloads. Rooms are ephemeral (cleanup_rooms
-- reaps them), so the blast radius is "players mid-round must reload".
--
-- ---------------------------------------------------------------------------
-- What was wrong
-- ---------------------------------------------------------------------------
-- Every host-only RPC proved "I am the host" with _assert_admin(), which
-- compares a CLIENT-SUPPLIED p_player_id against rooms.host_player_id. Both
-- rooms.host_player_id and room_players.id are granted to `anon`:
--
--   grant select (id, status, mode, host_player_id, ...) on rooms to anon;
--   grant select on room_players to anon;
--
-- So the thing that proved authority was published to everyone holding the
-- public anon key. Two unauthenticated GETs and you could start, end, restart,
-- re-configure, kick from or hand away ANY room — without joining it. The
-- schema hides rooms.code so strangers cannot join; it never hid the credential.
--
-- Three more holes shared that root:
--   * leave_room() had no authorization AT ALL — it deleted whatever
--     p_player_id you named. That bypassed every guard kick_player() applies
--     (lobby-only, not-yourself, not-the-host), so it worked mid-round, on the
--     host, from anyone.
--   * submit_answer() accepted any p_player_id, so you could answer for someone
--     else and break their streak.
--   * submit_answer() RETURNED the correct answer even on a wrong guess, and
--     deliberately allows changing your answer while the question is open. So:
--     submit garbage, read `correctAnswer` from the response, submit that.
--     A guaranteed 100%, no other player needed.
--
-- ---------------------------------------------------------------------------
-- The fix
-- ---------------------------------------------------------------------------
-- Split the seat's PUBLIC IDENTITY from its CREDENTIAL.
--
-- room_players.id stays public — the lobby renders by it, kicks target it,
-- rooms.host_player_id points at it and Realtime carries it. It just stops
-- being proof of anything. The proof moves to a random uuid in a separate
-- table anon cannot read at all, handed out once by the join/create RPCs
-- (which are SECURITY DEFINER and so can read it) and held only by that
-- player's client.
--
-- Keeping the secret in its own table, rather than as a column on room_players,
-- is deliberate: room_players keeps its table-wide grant, so the client's
-- `select('*')` keeps working. A column would have forced the same explicit
-- column-list surgery `rooms` needed for `code`, and one forgotten column there
-- takes multiplayer down entirely.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The credential
-- ---------------------------------------------------------------------------
create table if not exists public.room_player_tokens (
  player_id  uuid primary key references public.room_players(id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- RLS on with NO policies, plus an explicit revoke: unreachable from the anon
-- key by any route. Only SECURITY DEFINER functions (which run as the owner)
-- read it. Both halves matter — RLS alone would still let a table owner's
-- grant through, and a revoke alone would not survive a future blanket grant.
alter table public.room_player_tokens enable row level security;
revoke all on public.room_player_tokens from anon, authenticated;

-- Existing seats get tokens so the table is consistent, but their clients do
-- not know them and cannot act until they rejoin. That is the intended
-- cutover behaviour, not an oversight.
insert into public.room_player_tokens (player_id)
select id from public.room_players
on conflict (player_id) do nothing;

-- Idempotent issue-or-return. join_discord_room's rejoin path hands a player
-- back their EXISTING seat, so it must hand back the existing token too.
create or replace function public._issue_player_token(p_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  insert into public.room_player_tokens (player_id)
  values (p_player_id)
  on conflict (player_id) do nothing;
  select token into v_token from public.room_player_tokens where player_id = p_player_id;
  return v_token;
end; $$;
revoke all on function public._issue_player_token(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The checks
-- ---------------------------------------------------------------------------
-- "I am this seat": the room exists, the player is in it, and the caller holds
-- that seat's token. Returns the room so callers can inspect status/phase.
create or replace function public._assert_seat(p_room_id uuid, p_player_id uuid, p_token uuid)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if p_token is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.room_players rp
    join public.room_player_tokens t on t.player_id = rp.id
    where rp.id = p_player_id and rp.room_id = p_room_id and t.token = p_token
  ) then
    -- One message for "no such seat", "wrong room" and "bad token" alike:
    -- nothing here tells a prober which of the three it got wrong.
    raise exception 'Authentication required';
  end if;
  return r;
end; $$;
revoke all on function public._assert_seat(uuid, uuid, uuid) from public, anon, authenticated;

-- "I am this room's host": a valid seat that the room also points at as host.
-- The 2-argument version is dropped at the end of this migration, once nothing
-- calls it any more.
create or replace function public._assert_admin(p_room_id uuid, p_player_id uuid, p_token uuid)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._assert_seat(p_room_id, p_player_id, p_token);
  if r.host_player_id is distinct from p_player_id then
    raise exception 'Admin access required';
  end if;
  return r;
end; $$;
revoke all on function public._assert_admin(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Join / create hand the token out
-- ---------------------------------------------------------------------------
-- Signatures are unchanged, so these are plain replacements: only the returned
-- jsonb grows a `playerToken`.
create or replace function public.create_room(p_mode text, p_settings jsonb, p_host_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id)
  );
end; $$;

create or replace function public.join_room(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id)
  );
end; $$;

create or replace function public.join_discord_room(
  p_instance_id text, p_mode text, p_settings jsonb, p_player_name text, p_discord_user_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms; v_room_id uuid; v_player_id uuid; v_slot int;
  v_code text; v_attempts int := 0; v_instance text; v_discord_id text; v_spectator boolean; v_host uuid;
begin
  v_instance := trim(p_instance_id); v_discord_id := trim(p_discord_user_id);
  if char_length(v_instance) < 1 then raise exception 'Invalid Discord instance id'; end if;
  if char_length(trim(p_player_name)) < 1 or char_length(p_player_name) > 24 then raise exception 'Invalid player name'; end if;
  if char_length(v_discord_id) < 1 then raise exception 'Invalid Discord user id'; end if;
  perform public.cleanup_rooms();
  select * into v_room from public.rooms where discord_instance_id = v_instance;
  if found then
    select id into v_player_id from public.room_players where room_id = v_room.id and discord_user_id = v_discord_id limit 1;
    if v_player_id is not null then
      v_host := public._ensure_host(v_room.id);
      return jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'playerId', v_player_id,
        'playerToken', public._issue_player_token(v_player_id),
        'isHost', (v_host = v_player_id), 'created', false, 'rejoined', true, 'spectator', (v_room.status = 'playing'));
    end if;
    v_spectator := (v_room.status = 'playing');
    select count(*) into v_slot from public.room_players where room_id = v_room.id;
    insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id, spectator)
    values (v_room.id, trim(p_player_name), false, public._player_color(v_slot), public._player_icon(v_slot), v_discord_id, v_spectator)
    returning id into v_player_id;
    v_host := public._ensure_host(v_room.id);
    return jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'playerId', v_player_id,
      'playerToken', public._issue_player_token(v_player_id),
      'isHost', (v_host = v_player_id), 'created', false, 'rejoined', false, 'spectator', v_spectator);
  end if;
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 30 then raise exception 'Could not generate unique room code'; end if;
    v_code := public._gen_room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, mode, settings, discord_instance_id)
  values (v_code, p_mode, coalesce(p_settings, '{}'::jsonb), v_instance) returning id into v_room_id;
  insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id)
  values (v_room_id, trim(p_player_name), true, public._player_color(0), public._player_icon(0), v_discord_id)
  returning id into v_player_id;
  update public.rooms set host_player_id = v_player_id where id = v_room_id;
  return jsonb_build_object('roomId', v_room_id, 'code', v_code, 'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id),
    'isHost', true, 'created', true, 'rejoined', false, 'spectator', false);
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Host-only RPCs now require the seat token
-- ---------------------------------------------------------------------------
-- Each is DROPped, not replaced: adding a parameter creates an overload, and
-- leaving the old signature in place would leave the hole wide open next to
-- its own fix. Dropping also drops the grants, so each is re-granted below.

drop function if exists public.start_room(uuid, uuid, jsonb, jsonb);
create function public.start_room(
  p_room_id uuid, p_player_id uuid, p_token uuid, p_round_refs jsonb, p_answer_keys jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
  player_count int;
  result jsonb;
begin
  r := public._assert_admin(p_room_id, p_player_id, p_token);

  if r.status <> 'lobby' then
    raise exception 'Room is not in lobby';
  end if;

  -- Everyone in the lobby plays this round.
  update public.room_players set spectator = false where room_id = p_room_id;

  select count(*) into player_count
  from public.room_players
  where room_id = p_room_id;
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
end; $$;

drop function if exists public.end_room(uuid, uuid);
create function public.end_room(p_room_id uuid, p_player_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
begin
  perform public._assert_admin(p_room_id, p_player_id, p_token);
  -- Mark the game finished but KEEP the room so players can hit "Play again"
  -- and return to the lobby. Realtime notifies every client to show the
  -- final scoreboard. Stale finished rooms are reaped by cleanup_rooms.
  update public.rooms
  set status = 'finished', phase = 'reveal',
      finished_at = now(), question_ends_at = null
  where id = p_room_id;
  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end; $$;

drop function if exists public.restart_room(uuid, uuid);
create function public.restart_room(p_room_id uuid, p_player_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
begin
  perform public._assert_admin(p_room_id, p_player_id, p_token);

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
end; $$;

drop function if exists public.update_room_settings(uuid, uuid, text, jsonb);
create function public.update_room_settings(
  p_room_id uuid, p_player_id uuid, p_token uuid, p_mode text, p_settings jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
  result jsonb;
begin
  r := public._assert_admin(p_room_id, p_player_id, p_token);

  if r.status <> 'lobby' then
    raise exception 'Can only change settings in the lobby';
  end if;

  update public.rooms
  set mode = coalesce(nullif(trim(p_mode), ''), mode),
      settings = coalesce(p_settings, settings)
  where id = p_room_id;

  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end; $$;

drop function if exists public.kick_player(uuid, uuid, uuid);
create function public.kick_player(
  p_room_id uuid, p_admin_player_id uuid, p_token uuid, p_target_player_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
begin
  r := public._assert_admin(p_room_id, p_admin_player_id, p_token);

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
end; $$;

drop function if exists public.make_host(uuid, uuid, uuid);
create function public.make_host(
  p_room_id uuid, p_player_id uuid, p_token uuid, p_target_player_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._assert_admin(p_room_id, p_player_id, p_token);
  if not exists (select 1 from public.room_players where id = p_target_player_id and room_id = p_room_id) then
    raise exception 'No such player in room';
  end if;
  update public.rooms set host_player_id = p_target_player_id where id = p_room_id;
  update public.room_players set is_host = (id = p_target_player_id) where room_id = p_room_id;
  return jsonb_build_object('ok', true);
end; $$;

-- leave_room had NO check of any kind. It only ever needed to prove "this is my
-- own seat", which is exactly _assert_seat — no host rights required, since
-- leaving is not a privileged act.
drop function if exists public.leave_room(uuid, uuid);
create function public.leave_room(p_room_id uuid, p_player_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_remaining int;
begin
  -- A room that is already gone is a successful leave, not an error: the
  -- unload beacon races cleanup_rooms() and the last player's own teardown.
  if not exists (select 1 from public.rooms where id = p_room_id) then
    return jsonb_build_object('ok', true);
  end if;
  perform public._assert_seat(p_room_id, p_player_id, p_token);

  delete from public.room_players where id = p_player_id and room_id = p_room_id;
  select count(*) into v_remaining from public.room_players where room_id = p_room_id;
  if v_remaining = 0 then
    delete from public.rooms where id = p_room_id;
    return jsonb_build_object('ok', true, 'roomClosed', true);
  end if;
  perform public._ensure_host(p_room_id);
  return jsonb_build_object('ok', true);
end; $$;

-- ---------------------------------------------------------------------------
-- 5. submit_answer: no answer leak, no borrowed seat, no client-supplied clock
-- ---------------------------------------------------------------------------
-- Three changes beyond the token:
--
--   * It no longer returns `isCorrect` or `correctAnswer`. Changing your answer
--     while the question is open is a deliberate feature (see the comment in
--     src/modules/game.js: "keep every option clickable so it can be changed"),
--     and it is harmless — but ONLY if each submission tells you nothing. With
--     per-submission feedback, "wrong, wrong, right" is a free answer key, so
--     the feedback is what had to go, not the feature. The client never read
--     these fields: it renders feedback at the reveal from its own bundled
--     question bank. Verified against every submitAnswer() call site.
--
--   * p_time_left is GONE. It was client-supplied and only floored at zero, so
--     any value scored: _score_points is round((100 + 10*time_left) * mult).
--     The remaining time is now read from rooms.question_ends_at, which the
--     server set. Latency makes this a shade lower than the client's own
--     countdown, which is both fair and unavoidable.
--
--   * Spectators are refused. The client already guards this, but the server
--     did not — and a spectator's answer also counted toward `answered_count`
--     while `active_players` excluded them, so one spectator answering could
--     flip the question to reveal before the actual players had answered.
drop function if exists public.submit_answer(uuid, uuid, text, int);
create function public.submit_answer(
  p_room_id uuid, p_player_id uuid, p_token uuid, p_answer text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
  correct_answer text;
  is_ok boolean;
  v_time_left int;
  active_players int;
  answered_count int;
  everyone boolean;
  reveal_seconds int;
begin
  r := public._assert_seat(p_room_id, p_player_id, p_token);

  -- Re-read under a row lock now that the caller is known to be a real seat.
  select * into r from public.rooms where id = p_room_id for update;
  if r.status <> 'playing' then raise exception 'Game not in progress'; end if;
  if r.phase <> 'question' then raise exception 'Not accepting answers'; end if;

  if exists (
    select 1 from public.room_players
    where id = p_player_id and room_id = p_room_id and coalesce(spectator, false)
  ) then
    raise exception 'Spectators cannot answer';
  end if;

  reveal_seconds := case
    when r.settings->>'feedbackDelay' in ('2', '4', '6') then (r.settings->>'feedbackDelay')::int
    else 4
  end;

  -- Server-authoritative remaining time, clamped into the range the scoring
  -- formula was designed for. 60 is the longest selectable timer; the ceiling
  -- is what keeps _score_points bounded (and so keeps a room's scores inside
  -- the 21000 cap that RLS enforces on the global leaderboard).
  v_time_left := greatest(0, least(60,
    floor(extract(epoch from (coalesce(r.question_ends_at, now()) - now())))::int));

  correct_answer := public._answer_for_index(p_room_id, r.question_index);
  is_ok := trim(p_answer) = trim(correct_answer);

  -- Store (or replace) the pick. The score is NOT touched here — it is applied
  -- for everyone at the reveal (see _settle_question).
  insert into public.room_answers (room_id, player_id, question_index, answer, time_left, points, is_correct)
  values (p_room_id, p_player_id, r.question_index, p_answer, v_time_left, 0, is_ok)
  on conflict (room_id, player_id, question_index) do update
    set answer = excluded.answer,
        time_left = excluded.time_left,
        is_correct = excluded.is_correct,
        submitted_at = now();

  -- Everyone has now answered: settle scores and use the host's review delay.
  select count(*) into active_players
  from public.room_players
  where room_id = p_room_id and coalesce(spectator, false) = false;
  select count(*) into answered_count
  from public.room_answers ra
  join public.room_players rp on rp.id = ra.player_id
  where ra.room_id = p_room_id and ra.question_index = r.question_index
    and coalesce(rp.spectator, false) = false;
  everyone := active_players > 0 and answered_count >= active_players;

  if everyone then
    update public.rooms
    set phase = 'reveal',
        question_ends_at = now() + make_interval(secs => reveal_seconds)
    where id = p_room_id and phase = 'question';
    if found then
      perform public._settle_question(p_room_id, r.question_index);
    end if;
  end if;

  -- `everyoneAnswered` is the only thing a caller learns, and it is already
  -- visible to everyone through rooms.phase on Realtime.
  return jsonb_build_object('everyoneAnswered', everyone);
end; $$;

-- ---------------------------------------------------------------------------
-- 6. room_answers stops being world-readable
-- ---------------------------------------------------------------------------
-- room_answer_keys was correctly hidden, but room_answers stores each player's
-- `answer` and `is_correct` the instant they submit, and anon could SELECT the
-- whole table. Polling it during an open question read the answer key off the
-- first player to get it right.
--
-- The client only needs this at the reveal, to show who picked what
-- (renderRevealChips). So: revoke the table and serve that one view through an
-- RPC that refuses to answer about a question still in play.
revoke select on public.room_answers from anon, authenticated;
drop policy if exists "public read room_answers" on public.room_answers;

create or replace function public.room_answers_for(p_room_id uuid, p_index int)
returns table (player_id uuid, answer text)
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  -- Past questions are settled history; the current one only once it is being
  -- revealed (or the room has ended). Anything still open discloses nothing.
  if not (p_index < r.question_index
          or r.status = 'finished'
          or (p_index = r.question_index and r.phase = 'reveal')) then
    return;
  end if;
  return query
    select ra.player_id, ra.answer
    from public.room_answers ra
    where ra.room_id = p_room_id and ra.question_index = p_index;
end; $$;
grant execute on function public.room_answers_for(uuid, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6b. The admin panel's "join a live room" seat needs a token too
-- ---------------------------------------------------------------------------
-- admin_join_room is service-role only (revoked from anon); /api/admin calls it
-- and hands the seat back to the admin's browser, which then drives it as an
-- ordinary player. Without a token that seat could not answer or leave.
create or replace function public.admin_join_room(p_room_id uuid, p_name text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room      public.rooms;
  v_base      text;
  v_name      text;
  v_suffix    text;
  v_slot      int;
  v_player_id uuid;
  v_spectator boolean;
  v_n         int := 2;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  v_base := nullif(trim(coalesce(p_name, '')), '');
  if v_base is null then
    raise exception 'Invalid player name';
  end if;
  v_base := left(v_base, 24);

  -- Mid-round joiners watch the current round, exactly like the Discord
  -- late-join path; start_room un-spectators them for the next one.
  v_spectator := (v_room.status <> 'lobby');

  -- join_room errors on a duplicate name. Here the admin's display name may
  -- already be in the room, so suffix instead — staying inside the 24-char
  -- limit room_players.name enforces.
  v_name := v_base;
  while exists (
    select 1 from public.room_players
    where room_id = v_room.id and lower(trim(name)) = lower(v_name)
  ) loop
    if v_n > 99 then
      raise exception 'Name already taken in this room';
    end if;
    v_suffix := ' (' || v_n::text || ')';
    v_name := rtrim(left(v_base, 24 - char_length(v_suffix))) || v_suffix;
    v_n := v_n + 1;
  end loop;

  select count(*) into v_slot from public.room_players where room_id = v_room.id;

  insert into public.room_players (room_id, name, is_host, color, icon, spectator)
  values (v_room.id, v_name, false,
          public._player_color(v_slot), public._player_icon(v_slot), v_spectator)
  returning id into v_player_id;

  return jsonb_build_object(
    'ok', true,
    'roomId', v_room.id,
    'code', v_room.code,
    'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id),
    'name', v_name,
    'spectator', v_spectator,
    'status', v_room.status
  );
end $$;
revoke all on function public.admin_join_room(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_join_room(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Re-grant, and retire the old host check
-- ---------------------------------------------------------------------------
grant execute on function public.start_room(uuid, uuid, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.end_room(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.restart_room(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.update_room_settings(uuid, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.kick_player(uuid, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.make_host(uuid, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.leave_room(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, uuid, text) to anon, authenticated;

-- Nothing references the 2-argument host check any more (verified against
-- pg_get_functiondef across the whole public schema before writing this).
-- Dropping it means a future RPC cannot accidentally reintroduce the hole by
-- calling the version that trusts a client-supplied id.
drop function if exists public._assert_admin(uuid, uuid);
