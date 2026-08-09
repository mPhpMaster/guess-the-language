<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { mpRoomAvatarOf } from '$lib/multiplayer/avatars';
  import { room } from '$lib/multiplayer/room.svelte';

  interface Props {
    onleave: () => void;
  }

  let { onleave }: Props = $props();

  const board = $derived(room.leaderboard((p) => mpRoomAvatarOf(p, room.playerId)));

  function isPhoto(v: string): boolean {
    return v.startsWith('http');
  }
</script>

<section class="screen active" id="screen-results">
  <div class="results-card">
    <div class="trophy">🏆</div>
    <h2 class="screen-heading" tabindex="-1">{i18n.t('roomResults')}</h2>

    <div class="leaderboard" role="list">
      {#each board as entry, i (entry.id)}
        <div class="lb-row" class:is-you={entry.you} role="listitem">
          <span class="lb-rank">{i + 1}</span>
          {#if isPhoto(entry.avatar)}
            <img class="lb-avatar-img" src={entry.avatar} alt="" referrerpolicy="no-referrer" />
          {:else}
            <span class="lb-avatar" style:background={entry.color}>{entry.avatar}</span>
          {/if}
          <span class="lb-name">{entry.name}</span>
          <span class="lb-score">{entry.score}</span>
        </div>
      {/each}
    </div>

    <div class="results-buttons">
      {#if room.isHost}
        <!-- The room is kept (status -> finished), so restarting reuses it. -->
        <button class="btn btn-accent" type="button" onclick={() => room.restart()}>
          {i18n.t('replay')}
        </button>
      {/if}
      <button class="btn btn-ghost" type="button" onclick={onleave}>{i18n.t('leaveRoom')}</button>
    </div>
  </div>
</section>
