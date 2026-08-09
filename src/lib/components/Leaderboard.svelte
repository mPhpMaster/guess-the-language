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

  /**
   * Each row is a bar whose width is its share of the top score — the widest bar
   * is the leader. The label lives *inside* the fill, which is why the fill needs
   * a real width rather than the CSS default.
   */
  const max = $derived(Math.max(...rows.map((r) => r.score), 1));

  function isYou(name: string): boolean {
    return !!youName && name.toLowerCase() === youName.toLowerCase();
  }

  function rankClass(i: number): string {
    return i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
  }

  function badge(i: number): string {
    return i === 0 ? ' 🥇' : i === 1 ? ' 🥈' : i === 2 ? ' 🥉' : '';
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
      {@const you = isYou(name)}
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
          class="lb-row {rankClass(i)}"
          class:is-clickable={!!onopen}
          class:is-you={you}
          role={onopen ? undefined : 'listitem'}
          type={onopen ? 'button' : undefined}
          onclick={onopen ? () => onopen(name, row.avatar ?? null) : undefined}
        >
          <div class="lb-rank">{i + 1}</div>
          <div class="lb-bar-wrap">
            <div class="lb-bar-bg"></div>
            <div class="lb-bar-fill" style:width="{Math.max(18, (row.score / max) * 100)}%">
              {name}{badge(i)} — {row.score} pts
              {#if row.multiplayer}
                <span class="lb-mp-tag" title={i18n.t('multiplayerScore')}> 👥</span>
              {/if}
              {#if you}
                <span class="lb-tag"> {i18n.t('you')}</span>
              {/if}
            </div>
          </div>
          <!--
            The <img> must stay INSIDE .lb-avatar: that div carries the 48px box
            and .lb-avatar-img is sized at 100% of its parent, so hoisting the
            image out makes it 100% of the whole row instead.
          -->
          <div class="lb-avatar" aria-hidden="true">
            {#if row.avatar}
              <img class="lb-avatar-img" src={row.avatar} alt="" referrerpolicy="no-referrer" />
            {:else}
              {avatarFor(name)}
            {/if}
          </div>
        </svelte:element>

        {#if onreport && !you && Number(row.id) > 0}
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
  /* The row is a <button> here, not the original's <div>. Strip the control
     chrome the browser adds so it looks identical to the inert variant. */
  .lb-row-wrap > :global(button.lb-row) {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .lb-row-wrap > :global(button.lb-row.is-you) {
    background: linear-gradient(90deg, #2ec5ff26, #2ec5ff08);
  }
</style>
