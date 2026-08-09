<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { totalQuestionCount } from '$lib/services/questions';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let questionCount = $state<number | null>(null);
  let version = $state<string | null>(null);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  // Counting requires every bank, so only pay for it when the panel is opened.
  $effect(() => {
    if (!open || questionCount !== null) return;
    void totalQuestionCount()
      .then((n) => (questionCount = n))
      .catch(() => (questionCount = null));
  });

  $effect(() => {
    if (!open || version !== null) return;
    const fromShell = window.appWindow?.getVersion?.();
    if (fromShell) void fromShell.then((v) => (version = v)).catch(() => {});
    else version = __GTL_VERSION__;
  });
</script>

<dialog class="popover" bind:this={dialog} onclose={onclose}>
  <h3>{i18n.t('aboutTitle')}</h3>
  <p>{i18n.t('aboutDesc')}</p>

  <div class="setting-row">
    <span>{i18n.t('aboutQuestions')}</span>
    <span>{questionCount ?? '…'}</span>
  </div>

  {#if version}
    <div class="setting-row">
      <span>{i18n.t('appTitle')}</span>
      <span dir="ltr">v{version}</span>
    </div>
  {/if}

  <button class="btn btn-primary" type="button" onclick={onclose}>{i18n.t('close')}</button>
</dialog>
