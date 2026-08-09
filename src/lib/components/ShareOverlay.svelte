<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { discord, openExternal, shareLink } from '$lib/services/discord.svelte';

  interface Props {
    /** Object URL for the rendered card; null hides the overlay. */
    objectUrl: string | null;
    blob: Blob | null;
    /** Public URL after upload, when available. */
    publicUrl: string | null;
    /** Message used for the Discord share sheet. */
    message: string;
    onclose: () => void;
  }

  let { objectUrl, blob, publicUrl, message, onclose }: Props = $props();

  let note = $state<string | null>(null);

  function flash(text: string): void {
    note = text;
    setTimeout(() => (note = null), 2000);
  }

  async function copyImage(): Promise<void> {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(i18n.t('copied'));
    } catch {
      flash(i18n.t('copyFailed'));
    }
  }

  function download(): void {
    if (!objectUrl) return;
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'guess-the-language.png';
      a.click();
      flash(i18n.t('downloadStarted'));
    } catch {
      flash(i18n.t('downloadBlocked'));
    }
  }

  async function copyLink(): Promise<void> {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      flash(i18n.t('shareLinkCopied2'));
    } catch {
      flash(i18n.t('copyFailed'));
    }
  }
</script>

{#if objectUrl}
  <div class="share-overlay show" role="dialog" aria-modal="true">
    <div class="share-card-box">
      <img class="share-img" src={objectUrl} alt="" />

      <div class="share-actions">
        <!--
          Discord's iframe blocks clipboard-image writes and downloads outright,
          so inside the Activity the only workable actions are link-based.
        -->
        {#if discord.active}
          {#if publicUrl}
            <button class="btn btn-primary btn-sm" type="button" onclick={() => openExternal(publicUrl)}>
              {i18n.t('shareOpenImage')}
            </button>
            <button class="btn btn-sm" type="button" onclick={() => shareLink(message, null)}>
              {i18n.t('shareToDiscord')}
            </button>
            <button class="btn btn-sm" type="button" onclick={copyLink}>{i18n.t('shareCopyLink')}</button>
          {:else}
            <p class="lb-note">{i18n.t('shareDiscordHint')}</p>
          {/if}
        {:else}
          <button class="btn btn-primary btn-sm" type="button" onclick={copyImage}>{i18n.t('copyImage')}</button>
          <button class="btn btn-sm" type="button" onclick={download}>{i18n.t('download')}</button>
        {/if}
        <button class="btn btn-ghost btn-sm" type="button" onclick={onclose}>{i18n.t('close')}</button>
      </div>

      {#if note}<p class="lb-note" role="status">{note}</p>{/if}
    </div>
  </div>
{/if}
