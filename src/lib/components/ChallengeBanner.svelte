<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { modeMeta } from '$lib/game/modes';
  import type { Challenge } from '$lib/game/challenge';

  interface Props {
    challenge: Challenge | null;
    ondismiss: () => void;
  }

  let { challenge, ondismiss }: Props = $props();

  const text = $derived.by(() => {
    if (!challenge) return '';
    const mode = challenge.mode ? modeMeta(challenge.mode).title[i18n.lang].join(' ') : '';
    const score = challenge.score ?? 0;
    return i18n.lang === 'ar'
      ? `تحداك صديقك: تغلّب على ${score} نقطة في ${mode}`
      : `You've been challenged: beat ${score} points in ${mode}`;
  });
</script>

{#if challenge}
  <div class="challenge-banner">
    <span class="challenge-banner-text">{text}</span>
    <button
      class="challenge-banner-x"
      type="button"
      title={i18n.t('challengeDismiss')}
      aria-label={i18n.t('challengeDismiss')}
      onclick={ondismiss}>✕</button
    >
  </div>
{/if}
