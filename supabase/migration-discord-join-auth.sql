-- ===========================================================================
-- Discord room joins must prove identity, not assert it.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp), in
-- the SAME release as the client that calls /api/join-room. Hard cutover:
-- join_discord_room stops being callable with the anon key, so an older client
-- gets "permission denied" until it reloads.
--
-- ---------------------------------------------------------------------------
-- What was wrong
-- ---------------------------------------------------------------------------
-- join_discord_room(p_instance_id, ..., p_discord_user_id) took the caller's
-- Discord id as a plain parameter and believed it. Its rejoin path exists so a
-- player who refreshes the Activity gets their seat back rather than a ghost:
--
--     select id into v_player_id from room_players
--     where room_id = v_room.id and discord_user_id = v_discord_id;
--     if v_player_id is not null then return ... _issue_player_token(v_player_id);
--
-- So naming someone else's Discord id returned THEIR seat — and, after
-- migration-mp-seat-tokens.sql, their seat token with it.
--
-- This was not limited to people inside the Activity. Both inputs were ordinary
-- columns granted to `anon`:
--
--     rooms.discord_instance_id        -> which room
--     room_players.discord_user_id     -> whose seat
--
-- Two reads with the public key, one replay, and the attacker held the victim's
-- credential; if the victim was the host, the room went with it. Reproduced end
-- to end against production before writing this.
--
-- Note what this means about the previous migration: seat tokens closed the
-- general takeover, but this path was left as the one remaining way to obtain
-- another player's credential — and the token now flowed through it.
--
-- ---------------------------------------------------------------------------
-- The fix
-- ---------------------------------------------------------------------------
-- Postgres cannot verify the session HMAC (it does not hold APP_SESSION_SECRET,
-- and putting it there would be worse). So the identity check moves to Node,
-- where that secret already lives: /api/join-room verifies the signed session,
-- takes `sub` as the Discord id, and calls this RPC with the service-role key.
-- Same shape as /api/submit-score. The RPC itself is unchanged — it simply
-- stops being reachable by anyone who has not been through that door.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Only the service role may seat a Discord player
-- ---------------------------------------------------------------------------
revoke all on function public.join_discord_room(text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.join_discord_room(text, text, jsonb, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Stop publishing which Activity a room belongs to
-- ---------------------------------------------------------------------------
-- Defence in depth, and free: the client selects discord_instance_id in
-- ROOM_COLUMNS but never reads it (checked every use in src/). Dropping it from
-- the grant removes the "which room" half of the pair above from the public API
-- entirely, so the instance id has to be known from inside Discord rather than
-- discovered by listing rooms.
--
-- A column-level REVOKE is useless while a table-wide grant exists, and `rooms`
-- is already on an explicit column list (see migration rooms_hide_code_from_anon)
-- — so re-grant that list minus this column. Keep it in step with ROOM_COLUMNS
-- in src/multiplayer.js: a column named there but missing here makes a client
-- asking for it fail with "permission denied for table rooms".
revoke select on public.rooms from anon, authenticated;
grant select (
  id, status, mode, host_player_id, created_at, finished_at,
  settings, round_refs, question_index, question_ends_at, phase
) on public.rooms to anon, authenticated;

-- room_players.discord_user_id deliberately STAYS readable: the lobby and the
-- player card resolve each player's real Discord avatar through it
-- (mpDiscordAvatarUrl in src/modules/leaderboard.js, the participant lookup in
-- src/modules/profile.js). It is not a secret — it is a public Discord id — and
-- with section 1 in place, knowing it no longer buys anything.
