<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import type { TextKey } from '$lib/i18n/index.svelte';

  /**
   * First-run tips.
   *
   * Shown once per browser, and only on the home screen: the original explicitly
   * skipped it anywhere else so it could never cover a lobby the player was
   * dropped straight into from a Discord voice channel.
   */

  interface Props {
    /** Only ever true on the home screen. */
    eligible: boolean;
  }

  let { eligible }: Props = $props();

  const KEY = 'gtl_onboarded';
  const TIPS: TextKey[] = ['onboardTip1', 'onboardTip2', 'onboardTip3', 'onboardTip4'];

  function seen(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      // No storage means no way to remember a dismissal, and an overlay that
      // returns on every load is worse than never showing it.
      return true;
    }
  }

  let open = $state(!seen());

  function dismiss(): void {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    open = false;
  }
</script>

{#if open && eligible}
  <div
    class="onboarding-overlay show"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) dismiss();
    }}
  >
    <div class="onboarding-card" role="dialog" aria-modal="true" aria-label={i18n.t('onboardTitle')}>
      <div class="onboarding-emoji" aria-hidden="true">🎮</div>
      <h3 class="onboarding-title">{i18n.t('onboardTitle')}</h3>
      <ul class="onboarding-tips">
        {#each TIPS as tip (tip)}
          <li>{i18n.t(tip)}</li>
        {/each}
      </ul>
      <button class="btn btn-primary onboarding-ok" type="button" onclick={dismiss}>
        {i18n.t('onboardGotIt')}
      </button>
    </div>
  </div>
{/if}
