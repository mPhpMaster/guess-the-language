<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';

  interface Props {
    answered: boolean;
    verdict: 'correct' | 'wrong' | null;
    onsubmit: (typed: string) => void;
  }

  let { answered, verdict, onsubmit }: Props = $props();

  let value = $state('');
  let input = $state<HTMLInputElement | null>(null);

  /** Clear and refocus whenever a new question arms the form. */
  $effect(() => {
    if (!answered) {
      value = '';
      input?.focus();
    }
  });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (answered) return;
    onsubmit(value);
  }
</script>

<form class="fill-form" dir="ltr" autocomplete="off" onsubmit={handleSubmit}>
  <input
    bind:this={input}
    bind:value
    type="text"
    class="fill-input"
    class:fill-correct={verdict === 'correct'}
    class:fill-wrong={verdict === 'wrong'}
    dir="ltr"
    disabled={answered}
    placeholder={i18n.t('fillPlaceholder')}
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    aria-label="Your answer"
  />
  <button type="submit" class="btn btn-primary fill-submit" disabled={answered}>
    {i18n.t('fillSubmit')}
  </button>
</form>
