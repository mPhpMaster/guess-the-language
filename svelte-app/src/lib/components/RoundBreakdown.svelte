<script lang="ts">
  import { buildBreakdown } from '$lib/game/breakdown';
  import { modeMeta } from '$lib/game/modes';
  import type { Bank, Difficulty, RoundAnswer } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';

  interface Props {
    history: readonly RoundAnswer[];
  }

  let { history }: Props = $props();

  const breakdown = $derived(buildBreakdown(history));

  function label(key: Bank | Difficulty): string {
    return breakdown?.axis === 'bank'
      ? modeMeta(key as Bank).title[i18n.lang].join(' ')
      : i18n.diffLabel(key as Difficulty);
  }
</script>

{#if breakdown}
  <div class="round-breakdown">
    <div class="rb-title">{i18n.t('breakdownTitle')}</div>
    <div class="rb-list">
      {#each breakdown.rows as row (row.key)}
        <div class="rb-row" class:is-best={row.best} class:is-worst={row.worst}>
          <span class="rb-name">{label(row.key)}</span>
          <span class="rb-bar"><span class="rb-fill" style:width="{row.pct}%"></span></span>
          <span class="rb-val">{row.correct}/{row.total}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}
