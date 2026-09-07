-- ===========================================================================
-- Bound what the public anon key may write.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp).
-- Independent of migration-mp-seat-tokens.sql and of any client release: every
-- statement here either narrows a privilege nothing legitimate uses, or adds a
-- bound the client already respects. Safe to run on its own, at any time.
--
-- The anon key ships inside the client, so "anon" means "anyone on the
-- internet". These four surfaces each granted more than the game needs.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. follows: stop granting DELETE-everything and UPDATE
-- ---------------------------------------------------------------------------
-- The policy was `for all ... using (true) with check (true)`. FOR ALL covers
-- UPDATE and DELETE, and `using (true)` matches every row — so one unfiltered
-- `DELETE FROM follows` from any client wiped every follow in the database.
--
-- Follow and unfollow genuinely are open here: names are self-asserted
-- throughout the game, so there is no identity to scope a policy to (that is
-- the same trust model as `scores`, and fixing it properly means finishing the
-- discord_id migration in migration-score-integrity.sql). What is NOT needed is
-- UPDATE — nothing in the client ever updates a follow row; it inserts and
-- deletes. Splitting the policy removes a whole verb from the attack surface
-- and makes the remaining exposure explicit rather than incidental.
drop policy if exists follows_all on public.follows;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
  for select to anon, authenticated using (true);

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to anon, authenticated with check (true);

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete to anon, authenticated using (true);

-- No UPDATE policy, and revoke the privilege outright so a future blanket
-- policy cannot quietly re-enable it.
revoke update on public.follows from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. presence / heartbeat: bound the row, and stop the free row factory
-- ---------------------------------------------------------------------------
-- presence.player is the primary key and comes straight from the caller, with
-- no length limit, no name check and no rate limit. So anyone could overwrite
-- any real player's live-presence row (the admin Live tab reads this), and
-- insert unbounded rows of unbounded length.
--
-- Overwriting cannot be fully closed while the key is a self-asserted name —
-- but the row can be bounded, and unbounded growth is the part that costs
-- money. Every field is now length-capped and the name must pass the same
-- profanity/format check `scores` uses.
alter table public.presence
  drop constraint if exists presence_player_len;
alter table public.presence
  add constraint presence_player_len
  check (char_length(player) between 1 and 24) not valid;

create or replace function public.heartbeat(
  p_player text, p_discord_id text, p_guild_id text, p_channel_id text,
  p_mode text, p_activity text, p_platform text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text := nullif(trim(p_player), '');
begin
  if v_name is null then return; end if;
  -- Silent no-ops rather than exceptions: a heartbeat is fire-and-forget
  -- decoration, and a raised error here would surface as a console error on
  -- every tick (which the client funnels into error_logs — see section 3).
  if char_length(v_name) > 24 then return; end if;
  if not public.is_safe_player_name(v_name) then return; end if;

  insert into public.presence(player, discord_id, guild_id, channel_id, mode, activity, platform, updated_at)
  values (v_name,
          left(nullif(p_discord_id, ''), 32),
          left(nullif(p_guild_id, ''), 32),
          left(nullif(p_channel_id, ''), 32),
          left(nullif(p_mode, ''), 32),
          left(nullif(p_activity, ''), 32),
          left(nullif(p_platform, ''), 32),
          now())
  on conflict (player) do update set
    discord_id = excluded.discord_id, guild_id = excluded.guild_id,
    channel_id = excluded.channel_id, mode = excluded.mode,
    activity = excluded.activity, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.heartbeat(text,text,text,text,text,text,text) from public;
grant execute on function public.heartbeat(text,text,text,text,text,text,text) to anon, authenticated;

-- The admin Live tab only ever looks at the last 3 minutes. Anything older is
-- dead weight an attacker can accumulate, so reap it on write.
create or replace function public.cleanup_presence()
returns void language sql security definer set search_path = public as $$
  delete from public.presence where updated_at < now() - interval '1 day';
$$;
revoke all on function public.cleanup_presence() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. error_logs: bound the row
-- ---------------------------------------------------------------------------
-- The insert policy was `with check (true)` with unbounded message / stack /
-- context. The client caps message at 2000 and stack at 8000 and throttles to
-- one row per unique error per 15s — but all of that is client-side, and the
-- table is writable by anyone with the anon key. These bounds mirror what the
-- client already sends, so no legitimate write changes.
drop policy if exists error_logs_insert_anon on public.error_logs;
create policy error_logs_insert_anon on public.error_logs
  for insert to anon, authenticated
  with check (
    char_length(message) between 1 and 2000
    and (stack is null or char_length(stack) <= 8000)
    and (source is null or char_length(source) <= 64)
    and (level is null or char_length(level) <= 16)
    and (player is null or char_length(player) <= 24)
    and (url is null or char_length(url) <= 500)
    and (app_version is null or char_length(app_version) <= 32)
    and (platform is null or char_length(platform) <= 32)
    and pg_column_size(context) <= 4096
  );

-- ---------------------------------------------------------------------------
-- 4. share-cards storage: stop it being free public file hosting
-- ---------------------------------------------------------------------------
-- The insert policy was `with check (bucket_id = 'share-cards')` on a PUBLIC,
-- readable bucket. Anyone with the anon key could upload unlimited 3MB PNGs
-- under any path and serve them off this project's domain.
--
-- The bucket must stay public and anon-writable — the whole point is that the
-- Discord Activity (whose iframe blocks downloads and clipboard writes) can
-- hand the user a real URL. What it does not need is arbitrary names: the game
-- writes `card-<epoch>-<rand>.png` at the bucket root (uploadShareCard() in
-- src/modules/results.js), so pin that shape.
--
-- Be clear about what this does and does not buy. The bucket already caps size
-- at 3MB and MIME at image/png, and this adds a name shape — but none of that
-- stops someone uploading a LOT of valid cards. Volume is not expressible in
-- RLS; capping it needs the upload to move behind /api with a per-session rate
-- limit, the way /api/submit-score already works. Worth doing if this bucket
-- ever starts costing real money.
drop policy if exists "share_cards_insert" on storage.objects;
create policy "share_cards_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'share-cards'
    and name like 'card-%'
    and name not like '%/%'
    and lower(right(name, 4)) = '.png'
    and char_length(name) <= 120
  );

-- Read stays open (the URL is meant to be shareable), and there is still no
-- update or delete policy, so an uploaded card cannot be overwritten.
drop policy if exists "share_cards_read" on storage.objects;
create policy "share_cards_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'share-cards');
