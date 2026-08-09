<script lang="ts">
  import type { Question } from '$lib/game/types';

  interface Props {
    question: Question;
    /** Locked in once the question is graded. */
    answered: boolean;
    selected: string | null;
    /** Labels removed by the 50:50 lifeline. */
    eliminated: string[];
    onpick: (label: string) => void;
  }

  let { question, answered, selected, eliminated, onpick }: Props = $props();

  function stateFor(label: string) {
    if (!answered) return { correct: false, wrong: false };
    return { correct: label === question.answer, wrong: label === selected && label !== question.answer };
  }
</script>

<div class="options-grid" class:cyber={question.style === 'cyber'} class:languages={question.style === 'languages'} dir="ltr">
  {#each question.options as opt, i (opt.label)}
    {@const s = stateFor(opt.label)}
    {@const gone = eliminated.includes(opt.label)}
    <button
      type="button"
      class={question.style === 'languages' ? 'lang-btn' : 'opt-btn'}
      class:selected={!answered && selected === opt.label}
      class:correct={s.correct}
      class:wrong={s.wrong}
      class:shake={s.wrong}
      class:eliminated={gone}
      disabled={answered || gone}
      onclick={() => onpick(opt.label)}
    >
      {#if question.style === 'languages'}
        <span class="opt-key" aria-hidden="true">{i + 1}</span>
        <span class="lang-icon" style:background={opt.color}>{opt.glyph}</span>
        <span class="lang-name">{opt.label}</span>
      {:else}
        <span class="opt-badge" style:background={opt.color}>{opt.glyph}</span>
        <span class="opt-text">{opt.label}</span>
      {/if}
    </button>
  {/each}
</div>
