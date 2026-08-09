<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';

  interface Props {
    /** Score to beat; null when this round didn't answer a challenge. */
    target: number | null;
    score: number;
    onchallengeback: () => void;
  }

  let { target, score, onchallengeback }: Props = $props();

  const won = $derived(target !== null && score > target);

  /** The i18n strings carry {you}/{target} placeholders. */
  const sub = $derived(
    i18n
      .t(won ? 'challengeWonSub' : 'challengeLostSub')
      .replace('{you}', String(score))
      .replace('{target}', String(target ?? 0))
  );
</script>

{#if target !== null}
  <div class="challenge-result" class:won class:lost={!won} role="status">
    <div class="cr-headline">{i18n.t(won ? 'challengeWon' : 'challengeLost')}</div>
    <div class="cr-sub">{sub}</div>
    <button class="btn btn-primary btn-sm" type="button" onclick={onchallengeback}>
      {i18n.t('challengeBack')}
    </button>
  </div>
{/if}
