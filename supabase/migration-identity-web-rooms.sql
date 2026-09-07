-- ===========================================================================
-- Identity anchoring, the last seat gap: web rooms.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- Backwards compatible in both directions — the existing signatures are
-- untouched and the new ones are unreachable until the client ships — so the
-- order does not matter.
--
-- ---------------------------------------------------------------------------
-- The gap
-- ---------------------------------------------------------------------------
-- register_room_scores() stamps each multiplayer row with the discord id on
-- that player's room_players seat. Discord Activity seats carry a verified one
-- since migration-discord-join-auth.sql, so those rows are anchored.
--
-- Seats created by create_room() and join_room() — the web "Host room" / "Join
-- with a code" path — set no discord_user_id at all. So a web player's
-- multiplayer results still land unanchored, for the same reason player_stats
-- was stuck at zero: not a broken writer, but no writer.
--
-- ---------------------------------------------------------------------------
-- Shape
-- ---------------------------------------------------------------------------
-- Identical to record_progress: two arities, not one defaulted parameter, so
-- that anon cannot supply the id. A `p_discord_id text default null` reads
-- better and is forgeable in one line.
--
--   create_room(mode, settings, host_name)              -> anon
--   create_room(mode, settings, host_name, discord_id)  -> service_role
--   join_room(code, name)                               -> anon
--   join_room(code, name, discord_id)                   -> service_role
--
-- /api/join-room fills the last argument from `sub` on the signed session.
--
-- The anon arities stay granted, and that is deliberate rather than legacy: the
-- Electron desktop build has no /api to call and no session token. Refusing to
-- let it host or join a room would delete working multiplayer to gain an id it
-- cannot produce. Those seats simply record no id, exactly as every seat does
-- today — the same "stamp when possible" rule as submitScore() and recordPlay().
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- create_room
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_mode text, p_settings jsonb, p_host_name text, p_discord_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_code text;
  v_attempts int := 0;
  v_did text := nullif(btrim(coalesce(p_discord_id, '')), '');
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

  insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id)
  values (v_room_id, trim(p_host_name), true,
          public._player_color(0), public._player_icon(0), v_did)
  returning id into v_player_id;

  update public.rooms set host_player_id = v_player_id where id = v_room_id;

  return jsonb_build_object(
    'roomId', v_room_id,
    'code', v_code,
    'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id)
  );
end; $$;

revoke all on function public.create_room(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.create_room(text, jsonb, text, text) to service_role;

create or replace function public.create_room(p_mode text, p_settings jsonb, p_host_name text)
returns jsonb language sql security definer set search_path = public as $$
  select public.create_room(p_mode, p_settings, p_host_name, null);
$$;

grant execute on function public.create_room(text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- join_room
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_code text, p_name text, p_discord_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_player_id uuid;
  v_slot int;
  v_did text := nullif(btrim(coalesce(p_discord_id, '')), '');
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

  insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id)
  values (v_room.id, trim(p_name), false,
          public._player_color(v_slot), public._player_icon(v_slot), v_did)
  returning id into v_player_id;

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'playerId', v_player_id,
    'playerToken', public._issue_player_token(v_player_id)
  );
end; $$;

revoke all on function public.join_room(text, text, text)
  from public, anon, authenticated;
grant execute on function public.join_room(text, text, text) to service_role;

create or replace function public.join_room(p_code text, p_name text)
returns jsonb language sql security definer set search_path = public as $$
  select public.join_room(p_code, p_name, null);
$$;

grant execute on function public.join_room(text, text) to anon, authenticated;
