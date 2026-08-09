import { i18n } from '$lib/i18n/index.svelte';
import { modeMeta } from '$lib/game/modes';
import type { ModeId } from '$lib/game/types';
import { room } from '$lib/multiplayer/room.svelte';
import { clearActivity, discord, discordProfile, setActivity, type PresenceActivity } from './discord.svelte';
import { sbFetch, supabaseConfigured } from './supabase';

/**
 * Two independent "presence" concerns:
 *   1. The Discord rich-presence card other members see on the player's profile.
 *   2. A heartbeat row that feeds the admin "who's playing right now" view.
 */

const MP_PARTY_MAX = Number(window.DISCORD_CONFIG?.maxParticipants) || 12;
const PRESENCE_IMAGE = window.DISCORD_CONFIG?.presenceImage || '8-modeselect';
const HEARTBEAT_MS = 25_000;

export type ScreenName = 'home' | 'lobby' | 'game' | 'results';

export interface PresenceInput {
  screen: ScreenName;
  mode: ModeId;
  score: number;
  /** 1-based question number and round length, for the solo round line. */
  current: number;
  total: number;
  enabled: boolean;
}

let roundStartedAt = 0;

export function markRoundStart(): void {
  roundStartedAt = Date.now();
}

function modeLabel(mode: ModeId): string {
  const meta = modeMeta(mode);
  return meta.title[i18n.lang].join(' ');
}

function scoreLine(score: number): string {
  return `${i18n.t('score')} ${score}`;
}

export function buildPresenceActivity(input: PresenceInput): PresenceActivity | null {
  if (!input.enabled || !discord.canSetActivity) return null;

  const onGame = input.screen === 'game';
  const onResults = input.screen === 'results';
  const activity: PresenceActivity = { type: 0, instance: true };
  if (roundStartedAt) activity.timestamps = { start: Math.floor(roundStartedAt / 1000) };

  const shownMode = modeLabel((room.online ? room.room?.mode : input.mode) ?? input.mode);
  if (PRESENCE_IMAGE) activity.assets = { large_image: PRESENCE_IMAGE, large_text: shownMode };

  if (room.online) {
    const active = room.activePlayers.length;
    const total = room.roundRefs.length;
    const current = Math.min(room.questionIndex + 1, total);

    activity.details = `${shownMode} • ${i18n.t('presenceRoom')}`;
    if (room.status === 'finished' || onResults) {
      activity.state = `${i18n.t('presenceResults')} • ${scoreLine(room.me?.score ?? 0)}`;
    } else if (room.status === 'playing' && onGame && total) {
      activity.state = room.amSpectator
        ? `${i18n.t('presenceSpectating')} • ${i18n.t('playerCardRound')} ${current}/${total}`
        : `${i18n.t('playerCardRound')} ${current}/${total} • ${scoreLine(room.me?.score ?? 0)}`;
    } else {
      activity.state = i18n.t('presenceLobby');
    }

    // `party` is what makes Discord render the "(2 of 12)" badge; the id must be
    // identical for everyone in the room so it counts the group rather than each
    // player separately. `secrets.join` is what adds "Ask to Join".
    if (room.roomId) {
      activity.party = {
        id: `gtl-room-${room.roomId}`,
        size: [Math.max(active, 1), Math.max(active, MP_PARTY_MAX)]
      };
      if (room.code) activity.secrets = { join: `room:${room.code}` };
    }
    return activity;
  }

  activity.details = `${shownMode} • ${i18n.t('presenceSolo')}`;
  if (onResults) {
    activity.state = `${i18n.t('presenceResults')} • ${scoreLine(input.score)}`;
  } else if (onGame) {
    activity.state = input.total
      ? `${i18n.t('playerCardRound')} ${input.current}/${input.total} • ${scoreLine(input.score)}`
      : scoreLine(input.score);
  } else {
    activity.state = i18n.t('presenceMenu');
  }

  // A solo player has no room to hand out, so no join secret — but others in the
  // voice channel can still launch the Activity, so keep the party badge.
  const instanceId = discord.instanceId;
  if (instanceId) activity.party = { id: `gtl-solo-${instanceId}`, size: [1, MP_PARTY_MAX] };
  return activity;
}

/** Refresh the profile card. Safe and cheap to call on every state change. */
export function pushPresence(input: PresenceInput): void {
  if (!discord.canSetActivity) return;
  const activity = buildPresenceActivity(input);
  if (activity) setActivity(activity);
  else clearActivity();
}

// ---------- heartbeat ----------

function currentPlatform(): string {
  try {
    if (discord.active) return 'discord';
    if (/electron/i.test(navigator.userAgent)) return 'electron';
  } catch {
    /* ignore */
  }
  return 'web';
}

function currentActivityKind(screen: ScreenName): string {
  if (screen === 'game') return 'playing';
  if (screen === 'lobby' || room.online) return 'lobby';
  return 'home';
}

/** Best-effort presence ping. Silent on failure — never affects gameplay. */
export function sendHeartbeat(player: string, screen: ScreenName, mode: ModeId): void {
  try {
    if (!supabaseConfigured() || !player || document.hidden) return;
    const prof = discordProfile();
    void sbFetch('rpc/heartbeat', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        p_player: player,
        p_discord_id: prof?.id ?? null,
        p_guild_id: discord.guildId,
        p_channel_id: discord.channelId,
        p_mode: mode,
        p_activity: currentActivityKind(screen),
        p_platform: currentPlatform()
      })
    }).catch(() => {});
  } catch {
    /* never let a heartbeat break the app */
  }
}

/**
 * Start the heartbeat loop. Returns a disposer so the caller's effect can stop
 * it — the original registered a visibilitychange listener that was never
 * removed.
 */
export function startHeartbeat(read: () => { player: string; screen: ScreenName; mode: ModeId }): () => void {
  const ping = () => {
    const { player, screen, mode } = read();
    sendHeartbeat(player, screen, mode);
  };
  ping();
  const timer = setInterval(ping, HEARTBEAT_MS);
  const onVisible = () => {
    if (!document.hidden) ping();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
