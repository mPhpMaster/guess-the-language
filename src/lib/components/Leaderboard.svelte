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
        Structure matches the original row exactly: rank, then avatar, then the
        score bar, with Report as the last child *inside* the row. The stylesheet
        assumes `.lb-row` is the direct flex child of `.leaderboard` — wrapping it
        in an extra element pushed the row past the container width (a horizontal
        scrollbar) because `.lb-row.is-you` deliberately bleeds into a negative
        margin.

        The row stays a <div role="listitem"> rather than a <button> so the report
        control can legally nest inside it; the click is made keyboard-operable
        with tabindex + Enter/Space, which is what the original did.
      -->
      <!--
        The row must stay a listitem inside `role="list"`, yet it also opens the
        player card. Svelte flags the tabindex/handlers on a non-interactive
        element; the alternative — role="button" — would break the list
        semantics, and a real <button> cannot legally contain the Report button.
        Keyboard access is provided explicitly below, so the behaviour the rule
        protects is present.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="lb-row {rankClass(i)}"
        class:is-clickable={!!onopen}
        class:is-you={you}
        role="listitem"
        tabindex={onopen ? 0 : undefined}
        title={onopen ? `${name} — ${i18n.t('openPlayerCard')}` : undefined}
        onclick={(e) => {
          if (!onopen) return;
          // Report is a child; its own click must not also open the card.
          if ((e.target as HTMLElement).closest('.lb-report')) return;
          onopen(name, row.avatar ?? null);
        }}
        onkeydown={(e) => {
          if (!onopen || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onopen(name, row.avatar ?? null);
        }}
      >
        <div class="lb-rank">{i + 1}</div>

        <!--
          The <img> must stay INSIDE .lb-avatar: that div carries the 48px box and
          .lb-avatar-img is sized at 100% of its parent, so hoisting the image out
          makes it 100% of the whole row instead.
        -->
        <div class="lb-avatar" aria-hidden="true">
          {#if row.avatar}
            <img class="lb-avatar-img" src={row.avatar} alt="" referrerpolicy="no-referrer" />
          {:else}
            {avatarFor(name)}
          {/if}
        </div>

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
