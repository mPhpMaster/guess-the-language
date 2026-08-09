<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';

  /**
   * Custom title bar for the frameless Electron window. Without it the desktop
   * build has no way to move, maximize or close the window.
   *
   * `app.css` hides the controls on web (`html.platform-web`) and the whole bar
   * inside Discord (`html.platform-discord`), so this renders unconditionally
   * and the platform class decides what is visible.
   */
  const win = $derived(window.appWindow);
</script>

<div class="titlebar">
  <div class="titlebar-left">
    <span class="win-logo" aria-hidden="true">◆</span>
    <span class="titlebar-title">{i18n.t('appTitle')}</span>
  </div>
  <div class="titlebar-controls">
    <button class="tb-btn" type="button" aria-label="Minimize" onclick={() => win?.minimize()}>─</button>
    <button class="tb-btn" type="button" aria-label="Maximize" onclick={() => win?.toggleMaximize()}>▢</button>
    <button class="tb-btn tb-close" type="button" aria-label="Close" onclick={() => win?.close()}>✕</button>
  </div>
</div>
