<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';

  interface Props {
    label: string;
    danger?: boolean;
    run: () => Promise<unknown>;
    ondone?: () => void;
  }

  let { label, danger = false, run, ondone }: Props = $props();

  let armed = $state(false);
  let busy = $state(false);
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Click-twice to confirm rather than `window.confirm`, which Discord's iframe
   * can suppress outright — a native confirm there would silently never resolve
   * and the action would appear to do nothing.
   */
  async function onclick(): Promise<void> {
    if (busy) return;
    if (!armed) {
      armed = true;
      armTimer = setTimeout(() => (armed = false), 4000);
      return;
    }
    if (armTimer) clearTimeout(armTimer);
    armed = false;
    busy = true;
    try {
      await run();
      ondone?.();
    } catch (err) {
      console.error('admin action failed:', err);
    } finally {
      busy = false;
    }
  }

  $effect(() => () => {
    if (armTimer) clearTimeout(armTimer);
  });
</script>

<button
  class="admin-act"
  class:danger={danger}
  class:is-armed={armed}
  type="button"
  disabled={busy}
  {onclick}
>
  {armed ? i18n.t('adminConfirm') : label}
</button>
