-- ===========================================================================
-- Bound the last anon INSERT on the score boards.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- No client release needed: the bounds match exactly what the one remaining
-- anon caller already sends.
--
-- ---------------------------------------------------------------------------
-- What was loose
-- ---------------------------------------------------------------------------
-- The insert policy checked the score and the player name and nothing else, so
-- `avatar`, `mode` and `multiplayer` were free text the client chose:
--
--   * a leaderboard row could point its <img> at any host. The page CSP blocks
--     the load, but the row should not carry the URL in the first place;
--   * `mode` could be anything, inventing boards that do not exist;
--   * `multiplayer` could be set, so a single-player score could wear the
--     "👥 multiplayer" badge. v3.25.0 removed the client's ability to ask for
--     that flag; this removes the database's willingness to accept it.
--
-- ---------------------------------------------------------------------------
-- Why it can be tightened now
-- ---------------------------------------------------------------------------
-- This is the ONLY anon write path left to the boards, and it exists solely for
-- the Electron desktop build, which has no /api and no session token. The web
-- and Discord clients go through /api/submit-score, and multiplayer results are
-- written by register_room_scores() — which is SECURITY DEFINER and therefore
-- not subject to this policy at all. So the bounds can be exactly that one
-- caller's shape, with no guessing.
--
-- Verified as the `anon` role on production: a legitimate desktop row still
-- inserts; a fake multiplayer flag, a foreign avatar URL and an invented mode
-- are each refused.
-- ===========================================================================

drop policy if exists "public can insert scores" on public.scores;
create policy "public can insert scores"
  on public.scores for insert
  with check (
    score >= 0
    and score <= 21000
    and public.is_safe_player_name(player)
    and multiplayer = false
    and mode in ('languages','cybersecurity','devops','network','gamedev','algorithms','all')
    and (avatar is null or (avatar like 'https://cdn.discordapp.com/avatars/%'
                            and char_length(avatar) <= 300))
  );

-- The daily board takes no mode or multiplayer flag, so only the avatar and the
-- name check are added to its existing date window.
drop policy if exists daily_scores_insert_today on public.daily_scores;
create policy daily_scores_insert_today on public.daily_scores
  for insert to anon, authenticated
  with check (
    score >= 0
    and score <= 21000
    and day <= (now() at time zone 'utc')::date
    and day >= (now() at time zone 'utc')::date - 1
    and public.is_safe_player_name(player)
    and (avatar is null or (avatar like 'https://cdn.discordapp.com/avatars/%'
                            and char_length(avatar) <= 300))
  );
