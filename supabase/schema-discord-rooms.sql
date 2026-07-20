-- ===========================================================================
-- Discord Activity voice-channel rooms (run after schema-multiplayer.sql)
-- Maps discordSdk.instanceId -> shared Supabase room for everyone in the call.
-- ===========================================================================

alter table public.rooms
  add column if not exists discord_instance_id text;

alter table public.room_players
  add column if not exists discord_user_id text;

-- Late joiners (game already in progress) watch as spectators.
alter table public.room_players
  add column if not exists spectator boolean not null default false;

create unique index if not exists rooms_discord_instance_id_uidx
  on public.rooms (discord_instance_id)
  where discord_instance_id is not null;

create index if not exists room_players_discord_user_idx
  on public.room_players (room_id, discord_user_id)
  where discord_user_id is not null;

-- Join or create a room keyed by Discord Activity instanceId.
-- First player in a voice session becomes host; others auto-join the lobby.
create or replace function public.join_discord_room(
  p_instance_id text,
  p_mode text,
  p_settings jsonb,
  p_player_name text,
  p_discord_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_room_id uuid;
  v_player_id uuid;
  v_slot int;
  v_code text;
  v_attempts int := 0;
  v_instance text;
  v_discord_id text;
  v_spectator boolean;
begin
  v_instance := trim(p_instance_id);
  v_discord_id := trim(p_discord_user_id);

  if char_length(v_instance) < 1 then
    raise exception 'Invalid Discord instance id';
  end if;
  if char_length(trim(p_player_name)) < 1 or char_length(p_player_name) > 24 then
    raise exception 'Invalid player name';
  end if;
  if char_length(v_discord_id) < 1 then
    raise exception 'Invalid Discord user id';
  end if;

  perform public.cleanup_rooms();

  select * into v_room
  from public.rooms
  where discord_instance_id = v_instance;

  if found then
    select id into v_player_id
    from public.room_players
    where room_id = v_room.id and discord_user_id = v_discord_id
    limit 1;

    if v_player_id is not null then
      return jsonb_build_object(
        'roomId', v_room.id,
        'code', v_room.code,
        'playerId', v_player_id,
        'isHost', (v_room.host_player_id = v_player_id),
        'created', false,
        'rejoined', true,
        'spectator', (v_room.status = 'playing')
      );
    end if;

    -- A game already in progress can still be joined — as a spectator, who
    -- watches the round but can't answer and doesn't count toward it.
    v_spectator := (v_room.status = 'playing');

    select count(*) into v_slot from public.room_players where room_id = v_room.id;

    insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id, spectator)
    values (v_room.id, trim(p_player_name), false,
            public._player_color(v_slot), public._player_icon(v_slot), v_discord_id, v_spectator)
    returning id into v_player_id;

    return jsonb_build_object(
      'roomId', v_room.id,
      'code', v_room.code,
      'playerId', v_player_id,
      'isHost', false,
      'created', false,
      'rejoined', false,
      'spectator', v_spectator
    );
  end if;

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 30 then
      raise exception 'Could not generate unique room code';
    end if;
    v_code := public._gen_room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, mode, settings, discord_instance_id)
  values (v_code, p_mode, coalesce(p_settings, '{}'::jsonb), v_instance)
  returning id into v_room_id;

  insert into public.room_players (room_id, name, is_host, color, icon, discord_user_id)
  values (v_room_id, trim(p_player_name), true,
          public._player_color(0), public._player_icon(0), v_discord_id)
  returning id into v_player_id;

  update public.rooms set host_player_id = v_player_id where id = v_room_id;

  return jsonb_build_object(
    'roomId', v_room_id,
    'code', v_code,
    'playerId', v_player_id,
    'isHost', true,
    'created', true,
    'rejoined', false,
    'spectator', false
  );
end;
$$;

grant execute on function public.join_discord_room(text, text, jsonb, text, text)
  to anon, authenticated;
