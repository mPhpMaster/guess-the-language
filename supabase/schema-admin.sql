-- ============================================================
--  Admin panel: bans, live presence, report workflow
--  (mirror of migrations admin_panel_banned_presence_reports + admin_action_rpcs)
--
--  Security model: the in-game admin panel is gated by a signed `adm` claim in the
--  session token (set server-side in api/token.js from the real Discord username).
--  Every write goes through api/admin.js using the Supabase SERVICE ROLE key and the
--  service_role-only RPCs below — anon can never call them.
-- ============================================================

-- Banned players. Names stored lower(trim(...)) for case-insensitive matching.
create table if not exists public.banned_players (
  player text primary key,
  reason text,
  banned_by text,
  created_at timestamptz not null default now()
);
alter table public.banned_players enable row level security;
-- No anon policies: only the service-role admin API and the ban trigger touch it.

-- Live presence: who is playing right now and from which server (Discord guild).
create table if not exists public.presence (
  player text primary key,
  discord_id text,
  guild_id text,
  channel_id text,
  mode text,
  activity text,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.presence enable row level security;
create index if not exists presence_updated_idx on public.presence(updated_at desc);

-- Report workflow state (added onto the existing leaderboard_reports table).
alter table public.leaderboard_reports add column if not exists status text not null default 'open';
alter table public.leaderboard_reports add column if not exists resolved_at timestamptz;
alter table public.leaderboard_reports add column if not exists resolved_by text;
create index if not exists reports_status_idx on public.leaderboard_reports(status, created_at desc);

-- Heartbeat upsert — the ONLY anon write to presence.
create or replace function public.heartbeat(
  p_player text, p_discord_id text, p_guild_id text, p_channel_id text,
  p_mode text, p_activity text, p_platform text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text := nullif(trim(p_player), '');
begin
  if v_name is null then return; end if;
  insert into public.presence(player, discord_id, guild_id, channel_id, mode, activity, platform, updated_at)
  values (v_name, nullif(p_discord_id,''), nullif(p_guild_id,''), nullif(p_channel_id,''),
          nullif(p_mode,''), nullif(p_activity,''), nullif(p_platform,''), now())
  on conflict (player) do update set
    discord_id = excluded.discord_id, guild_id = excluded.guild_id,
    channel_id = excluded.channel_id, mode = excluded.mode,
    activity = excluded.activity, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.heartbeat(text,text,text,text,text,text,text) from public;
grant execute on function public.heartbeat(text,text,text,text,text,text,text) to anon, authenticated;

-- Reject score inserts from banned players (defence in depth).
create or replace function public.reject_banned_score() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.banned_players b where b.player = lower(trim(NEW.player))) then
    raise exception 'player is banned';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_reject_banned_score on public.scores;
create trigger trg_reject_banned_score before insert on public.scores
  for each row execute function public.reject_banned_score();
drop trigger if exists trg_reject_banned_daily on public.daily_scores;
create trigger trg_reject_banned_daily before insert on public.daily_scores
  for each row execute function public.reject_banned_score();

-- ===== Admin action RPCs (service_role only) =====
create or replace function public.admin_delete_score(p_id bigint, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.leaderboard_reports set status='resolved', resolved_at=now(), resolved_by=p_by
    where score_id = p_id and status = 'open';
  delete from public.scores where id = p_id;
end $$;

create or replace function public.admin_ban(p_player text, p_reason text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text := lower(trim(p_player));
begin
  if v_key is null or v_key = '' then raise exception 'empty player'; end if;
  update public.leaderboard_reports r set status='resolved', resolved_at=now(), resolved_by=p_by
    where r.status='open'
      and exists (select 1 from public.scores s where s.id = r.score_id and lower(trim(s.player)) = v_key);
  insert into public.banned_players(player, reason, banned_by)
    values (v_key, nullif(trim(p_reason),''), p_by)
    on conflict (player) do update set reason=excluded.reason, banned_by=excluded.banned_by, created_at=now();
  delete from public.scores where lower(trim(player)) = v_key;
  delete from public.daily_scores where lower(trim(player)) = v_key;
  delete from public.presence where lower(trim(player)) = v_key;
end $$;

create or replace function public.admin_unban(p_player text)
returns void language plpgsql security definer set search_path = public as $$
begin delete from public.banned_players where player = lower(trim(p_player)); end $$;

-- Full wipe: scores, daily scores, progression, presence.
create or replace function public.admin_reset_profile(p_player text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text := lower(trim(p_player));
begin
  if v_key is null or v_key = '' then raise exception 'empty player'; end if;
  delete from public.scores where lower(trim(player)) = v_key;
  delete from public.daily_scores where lower(trim(player)) = v_key;
  delete from public.player_stats where lower(trim(player)) = v_key;
  delete from public.presence where lower(trim(player)) = v_key;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_delete_score(bigint,text)', 'admin_ban(text,text,text)',
    'admin_unban(text)', 'admin_reset_profile(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;

-- ===== Share-card hosting (migration share_cards_storage_bucket) =====
-- Public, PNG-only, 3MB-capped bucket so the Discord Activity (whose iframe blocks
-- clipboard writes and downloads) can openExternalLink()/shareLink() a real URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-cards', 'share-cards', true, 3145728, array['image/png'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/png'];

drop policy if exists "share_cards_insert" on storage.objects;
create policy "share_cards_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'share-cards');
drop policy if exists "share_cards_read" on storage.objects;
create policy "share_cards_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'share-cards');
