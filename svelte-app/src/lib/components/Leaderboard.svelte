<script lang="ts">
  import { avatarFor, safeDisplayName } from '$lib/game/names';
  import { i18n } from '$lib/i18n/index.svelte';
  import type { ScoreRow } from '$lib/services/leaderboard';

  interface Props {
    rows: ScoreRow[];
    /** Highlights the current player's row. */
    youName?: string;
    loading?: boolean;
    error?: string | null;
  }

  let { rows, youName = '', loading = false, error = null }: Props = $props();

  const hidden = $derived(i18n.t('hiddenPlayer'));

  function medal(index: number): string {
    return index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
  }
</script>

<div class="leaderboard" role="list">
  {#if loading}
    <div class="lb-note">{i18n.t('lbLoading')}</div>
  {:else if error}
    <div class="lb-note">{error}</div>
  {:else if rows.length === 0}
    <div class="lb-note">{i18n.t('lbOnline')}</div>
  {:else}
    {#each rows as row, i (row.id)}
      {@const name = safeDisplayName(row.player, hidden)}
      <div
        class="lb-row {medal(i)}"
        class:is-you={!!youName && name.toLowerCase() === youName.toLowerCase()}
        role="listitem"
      >
        <span class="lb-rank">{i + 1}</span>
        {#if row.avatar}
          <img class="lb-avatar-img" src={row.avatar} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="lb-avatar" aria-hidden="true">{avatarFor(name)}</span>
        {/if}
        <span class="lb-name">{name}</span>
        <span class="lb-score">{row.score}</span>
      </div>
    {/each}
  {/if}
</div>
