<script lang="ts">
  import { i18n, type TextKey } from '$lib/i18n/index.svelte';
  import { ACHIEVEMENTS } from '$lib/services/profile';
  import { sfx } from '$lib/services/audio';

  interface Props {
    /** Achievement ids newly unlocked by the server; empty hides the toast. */
    ids: string[];
    onclear: () => void;
  }

  let { ids, onclear }: Props = $props();

  const VISIBLE_MS = 5000;

  const names = $derived(
    ids.map((id) => i18n.t(`ach_${id}` as TextKey)).join('  ·  ')
  );
  const icons = $derived(
    ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.icon ?? '🏆').join(' ')
  );

  // Celebrate, then auto-dismiss. Clearing through the callback keeps the parent
  // the single owner of the list.
  $effect(() => {
    if (!ids.length) return;
    sfx.finish();
    const timer = setTimeout(onclear, VISIBLE_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if ids.length}
  <div class="achievement-pop show" role="status" aria-live="polite">
    <div class="achievement-pop-title">{icons} {i18n.t('achievementUnlocked')}</div>
    <div class="achievement-pop-body">{names}</div>
  </div>
{/if}
