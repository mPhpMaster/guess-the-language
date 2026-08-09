<script lang="ts">
  import CodePanel from '$lib/components/CodePanel.svelte';
  import FillForm from '$lib/components/FillForm.svelte';
  import OptionsGrid from '$lib/components/OptionsGrid.svelte';
  import TimerRing from '$lib/components/TimerRing.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { game } from '$lib/state/game.svelte';

  interface Props {
    onend: () => void;
  }

  let { onend }: Props = $props();

  const question = $derived(game.current);
  const showStreak = $derived(game.streak >= 3);

  /** Keyboard answering: 1–9 / a–f pick the matching option. */
  function onKeydown(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
    if (!question || question.style === 'fill' || game.answered) return;

    let idx = -1;
    if (e.key >= '1' && e.key <= '9') idx = Number(e.key) - 1;
    else {
      const k = e.key.toLowerCase();
      if (k.length === 1 && k >= 'a' && k <= 'f') idx = k.charCodeAt(0) - 97;
    }
    if (idx < 0) return;

    const pickable = question.options.filter((o) => !game.eliminated.includes(o.label));
    const opt = pickable[idx];
    if (opt) {
      e.preventDefault();
      game.select(opt.label);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section class="screen active" id="screen-game">
  <h2 class="sr-only screen-heading" tabindex="-1">{i18n.t('gameTitle')}</h2>

  <div class="game-topbar">
    <div class="topbar-left">
      <div class="score-pill"><span>{i18n.t('score')}</span> <span>{game.score}</span></div>
      <div class="correct-pill">✓ <span>{game.correct}</span>/<span>{game.total}</span></div>
      {#if showStreak}
        <div class="streak-pill">🔥 <span>{game.streak}</span> &nbsp;×1.5</div>
      {/if}
    </div>

    <div class="topbar-right">
      {#if question && question.style !== 'fill'}
        <button
          class="lifeline-btn"
          type="button"
          title="50:50"
          disabled={!game.canUseFifty}
          onclick={() => game.useFifty()}
        >
          <span class="lifeline-icon" aria-hidden="true">50:50</span>
          <span class="lifeline-count">{game.lifelines}</span>
        </button>
      {/if}
      <div class="progress-pill">
        <span>{i18n.t('question')}</span>
        <span>{Math.min(game.index + 1, game.total)}</span> / <span>{game.total}</span>
      </div>
      <button class="end-btn" type="button" onclick={onend}>✕ <span>{i18n.t('endQuiz')}</span></button>
    </div>
  </div>

  {#if question}
    <div class="game-body">
      <div class="code-wrap">
        <CodePanel
          text={question.panelText}
          isCode={question.panelIsCode}
          difficulty={question.difficulty}
          difficultyLabel={i18n.diffLabel(question.difficulty)}
        />

        {#if game.feedback}
          <div class="feedback-panel">
            <div class="toast show {game.feedback.kind}" role="status" aria-live="polite">
              <span class="fb-headline">{game.feedback.headline}</span>
              <span class="fb-explanation">{game.feedback.explanation}</span>
            </div>
            <button class="btn btn-primary btn-sm" type="button" onclick={() => game.next()}>
              {i18n.t('nextQuestion')}
            </button>
          </div>
        {/if}
      </div>

      <TimerRing fraction={game.timeFraction} seconds={game.practice ? null : Math.max(0, game.timeLeft)} />
    </div>

    {#if question.questionText}
      <div class="question-text" dir="auto">{question.questionText}</div>
    {/if}

    {#if question.style === 'fill'}
      <FillForm
        answered={game.answered}
        verdict={game.fillVerdict}
        onsubmit={(typed) => game.submitFill(typed)}
      />
    {:else}
      <OptionsGrid
        {question}
        answered={game.answered}
        selected={game.selected}
        eliminated={game.eliminated}
        onpick={(label) => game.select(label)}
      />
    {/if}
  {/if}
</section>
