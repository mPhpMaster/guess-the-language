-- ===========================================================================
-- Identity anchoring, step (b) for multiplayer scores — and making them
-- server-authoritative while we are here.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- Ships with the client that calls register_room_scores(); the old path keeps
-- working until then, so the order does not matter.
--
-- ---------------------------------------------------------------------------
-- What was wrong
-- ---------------------------------------------------------------------------
-- When a room finished, the HOST posted everyone's scores to the global board:
--
--   registerMpScores()  ->  submitMpScores(rows)  ->  direct anon INSERT
--
-- Two problems in one call.
--
-- Integrity: the rows came from the host's own copy of mpState.players. One
-- player asserted every other player's score, over the public anon key, with
-- nothing checking it against what Postgres actually computed in
-- _settle_question(). The multiplayer path was described as
-- "server-authoritative" because the SCORING is; the REGISTRATION never was.
--
-- Identity: the insert runs as anon, and the "anon cannot set discord_id"
-- policy on `scores` forbids anon from setting that column. So multiplayer rows
-- could not carry a discord_id even in principle — a structural hole in step (b)
-- of supabase/migration-score-integrity.sql, not an oversight in the client.
--
-- ---------------------------------------------------------------------------
-- Why this is only now fixable
-- ---------------------------------------------------------------------------
-- Two things had to exist first, and both landed today:
--
--   * a seat token (migration-mp-seat-tokens.sql) that proves "I am really in
--     this room" without trusting a publicly readable id, so the function can
--     authenticate its caller without an /api round trip — which matters
--     because the Electron desktop build has no /api to call;
--   * a room_players.discord_user_id that is SERVER-VERIFIED
--     (migration-discord-join-auth.sql). Before that it was whatever the client
--     typed, so stamping scores from it would have anchored identity to a
--     forgeable value — worse than leaving it null.
--
-- So the function reads the scores Postgres computed and the ids the server
-- verified. The client asserts nothing.
--
-- ---------------------------------------------------------------------------
-- Avatars, the one thing the server cannot derive
-- ---------------------------------------------------------------------------
-- The board shows each player's Discord photo. Building that URL needs the
-- avatar HASH, which lives in the Discord SDK's participant list and never
-- reaches Postgres — only the user id does. Dropping it would visibly regress
-- the board to emoji, so the caller may supply a map, and every entry is checked
-- against that row's own verified discord_user_id before it is stored. A caller
-- can therefore only ever set a player's real Discord photo, which is the same
-- rule safeAvatar() applies in /api/submit-score.
-- ===========================================================================

-- One registration per finished round. Without this, a retry (or every client
-- calling instead of just the host) would double the board.
alter table public.rooms add column if not exists scores_registered_at timestamptz;

create or replace function public.register_room_scores(
  p_room_id uuid, p_player_id uuid, p_token uuid, p_avatars jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
  v_n int;
begin
  -- Proves the caller is really seated in this room. Any member may register;
  -- the values written do not depend on which one calls.
  r := public._assert_seat(p_room_id, p_player_id, p_token);

  if r.status <> 'finished' then
    raise exception 'Room is not finished';
  end if;

  -- Claim the registration atomically. Only the first caller writes; everyone
  -- else gets a quiet no-op rather than a duplicate board entry.
  update public.rooms set scores_registered_at = now()
  where id = p_room_id and scores_registered_at is null;
  if not found then
    return jsonb_build_object('ok', true, 'alreadyRegistered', true);
  end if;

  insert into public.scores (player, score, mode, multiplayer, avatar, discord_id)
  select
    rp.name,
    rp.score,
    r.mode,
    true,
    -- Only this player's own Discord photo, or nothing.
    case
      when rp.discord_user_id is not null
       and (p_avatars->>rp.id::text) like
             'https://cdn.discordapp.com/avatars/' || rp.discord_user_id || '/%'
       and char_length(p_avatars->>rp.id::text) <= 300
      then p_avatars->>rp.id::text
      else null
    end,
    rp.discord_user_id
  from public.room_players rp
  where rp.room_id = p_room_id
    and coalesce(rp.spectator, false) = false
    -- Never post a 0 (or negative) result: a player who scored nothing should
    -- not create a "— 0 pts" leaderboard entry. Same rule the client applied.
    and rp.score > 0
    -- Mirror the bounds RLS puts on an anon insert. This function is SECURITY
    -- DEFINER so it bypasses those policies; the ceiling has to be restated
    -- here or it would be the one write path with no upper bound.
    and rp.score <= 21000
    and public.is_safe_player_name(rp.name);

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'registered', v_n);
end $$;

grant execute on function public.register_room_scores(uuid, uuid, uuid, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Play again" reuses the room, so the claim has to be released or the second
-- round would silently register nothing.
-- ---------------------------------------------------------------------------
drop function if exists public.restart_room(uuid, uuid, uuid);
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
      round_refs = null, question_ends_at = null, finished_at = null,
      scores_registered_at = null
  where id = p_room_id;

  select to_jsonb(rooms.*) into result from public.rooms where id = p_room_id;
  return result;
end; $$;

grant execute on function public.restart_room(uuid, uuid, uuid) to anon, authenticated;
