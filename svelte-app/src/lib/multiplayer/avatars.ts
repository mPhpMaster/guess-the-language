import { avatarFor } from '$lib/game/names';
import { discordAvatarUrl, discordProfile, participantById } from '$lib/services/discord.svelte';
import type { RoomPlayer } from './types';

/**
 * Per-player identity for multiplayer. The server assigns a colour and icon at
 * join time; these palettes only cover older rows that predate that.
 */
export const MP_FALLBACK_COLORS: readonly string[] = [
  '#2ec5ff', '#19f0c4', '#ffd874', '#ff7a9c', '#b18cff',
  '#5fd0ff', '#25d07d', '#ff9f5a', '#f78fff', '#8cff6b', '#ff5470', '#74e0ff'
];

export const MP_FALLBACK_ICONS: readonly string[] = [
  '🦊', '🐼', '🦉', '🐙', '🦁', '🐯', '🐧', '🐸', '🦄', '🐢', '🦅', '🐲'
];

export interface MpVisual {
  name: string;
  icon: string;
  color: string;
}

export function mpVisualOf(player: RoomPlayer, allPlayers: readonly RoomPlayer[]): MpVisual {
  let idx = allPlayers.findIndex((p) => p.id === player.id);
  if (idx < 0) idx = 0;
  return {
    name: player.name,
    icon: player.icon || MP_FALLBACK_ICONS[idx % MP_FALLBACK_ICONS.length]!,
    color: player.color || MP_FALLBACK_COLORS[idx % MP_FALLBACK_COLORS.length]!
  };
}

/**
 * The real Discord photo for a room player, linking the room record to the live
 * Activity identity. The local player uses their own signed-in profile; everyone
 * else is matched by the `discord_user_id` on their row against the Activity's
 * connected participants (they are all in the same voice channel).
 */
export function mpDiscordAvatarUrl(player: RoomPlayer, localPlayerId: string | null): string | null {
  if (localPlayerId && player.id === localPlayerId) {
    const own = discordAvatarUrl(discordProfile());
    if (own) return own;
  }
  const did = player.discord_user_id;
  if (did) {
    const part = participantById(did);
    if (part?.avatar) return discordAvatarUrl({ id: part.id, avatar: part.avatar });
  }
  return null;
}

/**
 * Room-leaderboard avatar: the real Discord photo when resolvable, else the
 * player's assigned emoji icon, else a name-derived emoji.
 *
 * This resolver is the fix for the "where are the profile pictures" bug — the
 * room leaderboard used to hardcode the emoji and ignore the Discord photo.
 */
export function mpRoomAvatarOf(player: RoomPlayer, localPlayerId: string | null): string {
  return mpDiscordAvatarUrl(player, localPlayerId) || player.icon || avatarFor(player.name);
}
