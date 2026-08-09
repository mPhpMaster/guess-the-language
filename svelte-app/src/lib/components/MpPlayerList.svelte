<script lang="ts">
  import { mpRoomAvatarOf, mpVisualOf } from '$lib/multiplayer/avatars';
  import { room } from '$lib/multiplayer/room.svelte';
  import type { RoomPlayer } from '$lib/multiplayer/types';
  import { i18n } from '$lib/i18n/index.svelte';

  interface Props {
    players: RoomPlayer[];
    /** Host-only controls (kick / promote) render when true. */
    showHostControls?: boolean;
    compact?: boolean;
  }

  let { players, showHostControls = false, compact = false }: Props = $props();

  function avatar(p: RoomPlayer): string {
    return mpRoomAvatarOf(p, room.playerId);
  }

  /** A CDN URL renders as an <img>; anything else is an emoji badge. */
  function isPhoto(value: string): boolean {
    return value.startsWith('http');
  }
</script>

<div class="mp-player-list" class:mp-player-list-compact={compact}>
  {#each players as p (p.id)}
    {@const visual = mpVisualOf(p, players)}
    {@const av = avatar(p)}
    <div class="mp-player-row" class:is-you={p.id === room.playerId} class:is-spectator={p.spectator}>
      {#if isPhoto(av)}
        <img class="mp-player-avatar" src={av} alt="" referrerpolicy="no-referrer" />
      {:else}
        <span class="mp-player-icon" style:background={visual.color}>{av}</span>
      {/if}

      <span class="mp-player-name">{p.name}</span>

      {#if room.room?.host_player_id === p.id}
        <span class="mp-badge-host" aria-hidden="true">👑</span>
      {/if}
      {#if p.spectator}
        <span class="mp-badge-spectator">{i18n.t('statusSpectating')}</span>
      {/if}

      <span class="mp-player-score">{p.score}</span>

      {#if showHostControls && room.isHost && p.id !== room.playerId}
        <button
          class="mp-act"
          type="button"
          title={i18n.t('makeHost')}
          onclick={() => room.makeHost(p.id)}>👑</button
        >
        <button
          class="mp-act mp-act-danger"
          type="button"
          title={i18n.t('kickPlayer')}
          onclick={() => room.kick(p.id)}>✕</button
        >
      {/if}
    </div>
  {/each}
</div>
