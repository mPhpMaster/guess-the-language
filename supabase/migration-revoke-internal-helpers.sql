-- ===========================================================================
-- Close the internal helper functions to the public roles.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- No client release needed and no cutover: nothing in src/ or api/ calls any
-- `_`-prefixed function (verified by grep before writing this). They are only
-- ever called from inside other SECURITY DEFINER functions, which run as the
-- owner and are unaffected by these revokes.
--
-- ---------------------------------------------------------------------------
-- Why this is urgent
-- ---------------------------------------------------------------------------
-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default. These
-- schema files never revoked it for the internal helpers, so every one of them
-- was callable with the public anon key. The worst is not subtle:
--
--   _answer_for_index(p_room_id, p_index) -> text
--
-- is SECURITY DEFINER precisely so it can read room_answer_keys, which is
-- otherwise unreadable. So it will hand the correct answer to anyone who asks.
-- Both arguments are public: the room id is selectable from `rooms`, and the
-- question index is on the same row.
--
-- Demonstrated against production, with the public anon key, on a live room:
--
--   GET  /rest/v1/room_answer_keys?...  -> 200 []              (table protected)
--   POST /rest/v1/rpc/_answer_for_index -> 200 "THE-SECRET-ANSWER"
--
-- That defeats the whole point of migration-mp-seat-tokens.sql's answer work.
-- That migration stopped submit_answer echoing the answer and revoked
-- room_answers — and left the front door open beside the locked window.
--
-- Two more are directly abusable:
--   _settle_question(room, index)     -- force any question to settle, any time
--   _set_question_timer(room, index)  -- reset any room's timer, jump its index
--
-- The rest (_gen_room_code, _player_color, _player_icon, _score_points,
-- _duration_for_difficulty, _ensure_host) leak nothing much on their own, but
-- there is no reason for them to be reachable and every reason for the boundary
-- to be one simple rule: if it starts with an underscore, the public cannot call
-- it.
-- ===========================================================================

revoke all on function public._answer_for_index(uuid, int)        from public, anon, authenticated;
revoke all on function public._settle_question(uuid, int)         from public, anon, authenticated;
revoke all on function public._set_question_timer(uuid, int)      from public, anon, authenticated;
revoke all on function public._ensure_host(uuid)                  from public, anon, authenticated;
revoke all on function public._gen_room_code()                    from public, anon, authenticated;
revoke all on function public._duration_for_difficulty(text)      from public, anon, authenticated;
revoke all on function public._player_color(int)                  from public, anon, authenticated;
revoke all on function public._player_icon(int)                   from public, anon, authenticated;
revoke all on function public._score_points(int, int)             from public, anon, authenticated;

-- Trigger / event-trigger plumbing. Never meant to be invoked as an RPC;
-- reject_banned_score only makes sense inside its trigger, and rls_auto_enable
-- returns event_trigger, which PostgREST cannot even render.
revoke all on function public.reject_banned_score()               from public, anon, authenticated;
revoke all on function public.rls_auto_enable()                   from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deliberately NOT touched
-- ---------------------------------------------------------------------------
-- The intended public API keeps its grants: create_room, join_room, claim_host,
-- cleanup_rooms, tick_room, room_answers_for, heartbeat, record_play,
-- record_progress, is_safe_player_name, gtl_level_from_xp, and the eight
-- token-guarded room RPCs. Each is called from src/ (checked against the RPC
-- names the client actually uses).
--
-- This database is shared with another app, whose functions (apply_faint_penalty,
-- publish_score, set_active_monster, handle_new_user, handle_approval, has_role,
-- is_approved, is_member) are left exactly as they are. Some are anon-callable
-- and that may well be wrong for them too, but that is their owner's call, not
-- a decision to make from inside this repo.
--
-- The root cause is the default: `alter default privileges in schema public
-- revoke execute on functions from public` would make every FUTURE function
-- closed until explicitly granted, which is the right posture — but it changes
-- the rules for that other app's next function as well, so it is proposed rather
-- than applied here.
