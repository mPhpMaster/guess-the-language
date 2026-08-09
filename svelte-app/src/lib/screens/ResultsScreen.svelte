<script lang="ts">
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import type { ModeId } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { fetchTopScores, type Scope, type ScoreRow } from '$lib/services/leaderboard';
  import { supabaseConfigured } from '$lib/services/supabase';
  import { game } from '$lib/state/game.svelte';
  import { settings } from '$lib/state/settings.svelte';

  interface Props {
    onreplay: () => void;
    onhome: () => void;
    /** Rank fetched after the score was submitted, if any. */
    personalRank: number | null;
  }

  let { onreplay, onhome, personalRank }: Props = $props();

  let scope = $state<Scope>('all');
  let boardMode = $state<ModeId>(game.mode);
  let rows = $state<ScoreRow[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const wrongAnswers = $derived(game.history.filter((h) => !h.correct));

  // Refetch whenever the mode or scope selector changes.
  $effect(() => {
    const mode = boardMode;
    const sc = scope;
    if (!supabaseConfigured()) {
      error = i18n.t('lbOffline');
      return;
    }
    let cancelled = false;
    loading = true;
    error = null;
    fetchTopScores(mode, sc, 10, i18n.t('hiddenPlayer'))
      .then((result) => {
        if (!cancelled) rows = result;
      })
      .catch(() => {
        if (!cancelled) error = i18n.t('lbOffline');
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<section class="screen active" id="screen-results">
  <div class="results-card">
    <div class="trophy">🏆</div>

    <h2 class="final-score screen-heading" tabindex="-1">
      <span>{i18n.t('finalScore')}</span> <span>{game.score}</span>
    </h2>
    <p class="results-correct">
      <span>{i18n.t('correctLabel')}</span> <span>{game.correct}</span>/<span>{game.total}</span>
    </p>

    <div class="result-stats" aria-label="Round statistics">
      <div><strong>{game.accuracy}%</strong><span>{i18n.t('statAccuracy')}</span></div>
      <div><strong>{game.bestStreak}</strong><span>{i18n.t('statStreak')}</span></div>
    </div>

    {#if personalRank}
      <div class="personal-result">#{personalRank}</div>
    {/if}

    <p class="results-sub">{i18n.t('comparison')}</p>

    <div class="lb-scope-switch" role="group">
      <button
        type="button"
        class="lb-scope-btn"
        class:is-active={scope === 'all'}
        onclick={() => (scope = 'all')}>{i18n.t('scopeAllTime')}</button
      >
      <button
        type="button"
        class="lb-scope-btn"
        class:is-active={scope === 'week'}
        onclick={() => (scope = 'week')}>{i18n.t('scopeWeek')}</button
      >
    </div>

    <label class="lb-mode-switch">
      <span>{i18n.t('leaderboardFor')}</span>
      <select bind:value={boardMode}>
        <option value="languages">{i18n.t('modeLanguages')}</option>
        <option value="cybersecurity">{i18n.t('modeCyber')}</option>
        <option value="devops">{i18n.t('modeDevops')}</option>
        <option value="network">{i18n.t('modeNetwork')}</option>
        <option value="gamedev">{i18n.t('modeGamedev')}</option>
        <option value="algorithms">{i18n.t('modeAlgo')}</option>
        <option value="all">{i18n.t('modeAll')}</option>
      </select>
    </label>

    <Leaderboard {rows} {loading} {error} youName={settings.name} />

    {#if wrongAnswers.length}
      <details class="answer-review">
        <summary>{i18n.t('reviewAnswers')}</summary>
        <div>
          {#each wrongAnswers as item (item.question.id)}
            <div class="review-item">
              <div class="review-q" dir="auto">{item.question.questionText || item.question.panelText}</div>
              <div class="review-a">
                <span class="review-wrong">{item.chosen || '—'}</span>
                <span class="review-right">{item.question.answer}</span>
              </div>
              {#if item.question.explanation}
                <div class="review-exp" dir="auto">{i18n.pick(item.question.explanation)}</div>
              {/if}
            </div>
          {/each}
        </div>
      </details>
    {/if}

    <div class="results-buttons">
      <button class="btn btn-accent" type="button" onclick={onreplay}>{i18n.t('replay')}</button>
      <button class="btn btn-ghost" type="button" onclick={onhome}>{i18n.t('backMenu')}</button>
    </div>
  </div>
</section>
