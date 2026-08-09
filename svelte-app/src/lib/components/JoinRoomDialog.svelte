<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { normalizeCode } from '$lib/multiplayer/round';

  interface Props {
    open: boolean;
    busy: boolean;
    error: string | null;
    onjoin: (code: string) => void;
    onclose: () => void;
  }

  let { open, busy, error, onjoin, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let code = $state('');

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  const normalized = $derived(normalizeCode(code));
</script>

<dialog class="popover" bind:this={dialog} onclose={onclose}>
  <h3>{i18n.t('joinRoom')}</h3>

  <label class="setting-row">
    <span>{i18n.t('roomCode')}</span>
    <input
      type="text"
      value={code}
      maxlength="4"
      dir="ltr"
      autocapitalize="characters"
      spellcheck="false"
      oninput={(e) => (code = e.currentTarget.value)}
    />
  </label>

  {#if error}
    <p class="auth-error">{error}</p>
  {/if}

  <button
    class="btn btn-primary"
    type="button"
    disabled={busy || normalized.length < 4}
    onclick={() => onjoin(normalized)}
  >
    {busy ? i18n.t('loading') : i18n.t('joinRoom')}
  </button>
  <button class="btn btn-ghost" type="button" onclick={onclose}>{i18n.t('close')}</button>
</dialog>
