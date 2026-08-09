<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { openExternal } from '$lib/services/discord.svelte';
  import { totalQuestionCount } from '$lib/services/questions';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let questionCount = $state<number | null>(null);
  let version = $state<string | null>(null);

  /**
   * Project links. Routed through `openExternal` rather than plain anchors
   * because inside the Discord Activity an anchor is sandboxed — the SDK command
   * is the only thing that opens a real browser tab there.
   */
  const LINKS = [
    { icon: '💻', label: 'GitHub', url: 'https://github.com/mPhpMaster/guess-the-language' },
    { icon: '💬', label: 'Discord', url: 'https://discord.gg/BRgVPum' },
    { icon: '💼', label: 'LinkedIn', url: 'https://www.linkedin.com/in/mohammad-al-safadi/' }
  ];

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

  <div class="about-logo" aria-hidden="true">🎮</div>
  <p class="about-app">
    <span>{i18n.t('appTitle')}</span>
    <span id="about-version" dir="ltr">{version ? `v${version}` : ''}</span>
  </p>
  <p class="about-desc">{i18n.t('aboutDesc')}</p>
  <p class="about-count">
    <span>{i18n.t('aboutQuestions')}</span> <strong>{questionCount ?? '…'}</strong>
  </p>

  <div class="about-links">
    {#each LINKS as link (link.url)}
      <button class="about-link" type="button" onclick={() => openExternal(link.url)}>
        {link.icon} {link.label}
      </button>
    {/each}
  </div>

  <!-- Registered with Discord as the app's Terms and Privacy URLs; they are
       served from public/ at exactly these paths. -->
  <div class="about-legal">
    <a class="about-legal-link" href="/terms.html" target="_blank" rel="noopener noreferrer">
      Terms of Service
    </a>
    <span class="about-legal-sep">·</span>
    <a class="about-legal-link" href="/privacy.html" target="_blank" rel="noopener noreferrer">
      Privacy Policy
    </a>
  </div>

  <button class="btn btn-primary btn-sm" type="button" onclick={onclose}>{i18n.t('close')}</button>
</dialog>
