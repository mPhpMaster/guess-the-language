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
    /** Opens that player's profile card; rows are inert when omitted. */
    onopen?: (name: string, avatar: string | null) => void;
    /** Opens the report dialog for a row. Omitted when reporting is unavailable. */
    onreport?: (row: ScoreRow) => void;
    /** Confirmation shown under the board after a report lands. */
    note?: string | null;
  }

  let {
    rows,
    youName = '',
    loading = false,
    error = null,
    onopen,
    onreport,
    note = null
  }: Props = $props();

  const hidden = $derived(i18n.t('hiddenPlayer'));

  function isYou(name: string): boolean {
    return !!youName && name.toLowerCase() === youName.toLowerCase();
  }

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
      <!--
        Report sits *beside* the row rather than inside it. The original nested it
        in a clickable <div> and stopped propagation; here the row is a real
        <button>, and a button inside a button is invalid markup that browsers
        silently un-nest.
      -->
      <div class="lb-row-wrap">
        <!--
          A clickable row is a real <button> so it is keyboard- and
          screen-reader-operable for free; `role="listitem"` is only applied to
          the inert <div> variant, since a button carries its own semantics.
        -->
        <svelte:element
          this={onopen ? 'button' : 'div'}
          class="lb-row {medal(i)}"
          class:is-clickable={!!onopen}
          class:is-you={isYou(name)}
          role={onopen ? undefined : 'listitem'}
          type={onopen ? 'button' : undefined}
          onclick={onopen ? () => onopen(name, row.avatar ?? null) : undefined}
        >
          <span class="lb-rank">{i + 1}</span>
          {#if row.avatar}
            <img class="lb-avatar-img" src={row.avatar} alt="" referrerpolicy="no-referrer" />
          {:else}
            <span class="lb-avatar" aria-hidden="true">{avatarFor(name)}</span>
          {/if}
          <span class="lb-name">{name}</span>
          <span class="lb-score">{row.score}</span>
        </svelte:element>

        {#if onreport && !isYou(name) && Number(row.id) > 0}
          <button
            class="lb-report text-btn"
            type="button"
            title="{i18n.t('report')} — {name}"
            onclick={() => onreport(row)}>{i18n.t('report')}</button
          >
        {/if}
      </div>
    {/each}
  {/if}

  {#if note}
    <div class="lb-note">{note}</div>
  {/if}
</div>

<style>
  /* The report control is a sibling of the row, so the pair needs its own flex
     line; the row keeps every bit of the width the report button does not use. */
  .lb-row-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lb-row-wrap > :global(.lb-row) {
    flex: 1 1 auto;
    min-width: 0;
  }
</style>
