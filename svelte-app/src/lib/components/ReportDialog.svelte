<script lang="ts">
  import { safeDisplayName } from '$lib/game/names';
  import { i18n } from '$lib/i18n/index.svelte';
  import { submitReport, type ReportReason } from '$lib/services/report';
  import type { ScoreRow } from '$lib/services/leaderboard';

  interface Props {
    /** The entry being reported; null closes the dialog. */
    target: ScoreRow | null;
    onclose: () => void;
    /** Confirmation to surface next to the board once a report lands. */
    ondone: (message: string) => void;
  }

  let { target, onclose, ondone }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let reason = $state<ReportReason>('offensive_name');
  let details = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!dialog) return;
    if (target && !dialog.open) {
      // Reset per-open so a previous attempt's error or text never carries over.
      reason = 'offensive_name';
      details = '';
      error = null;
      dialog.showModal();
    } else if (!target && dialog.open) {
      dialog.close();
    }
  });

  async function send(): Promise<void> {
    if (!target || busy) return;
    busy = true;
    error = null;
    const outcome = await submitReport({ scoreId: target.id, reason, details });
    busy = false;
    if (outcome === 'ok') {
      ondone(i18n.t('reportSuccess'));
      onclose();
      return;
    }
    error = i18n.t(outcome === 'duplicate' ? 'reportDuplicate' : 'reportFailed');
  }
</script>

<dialog class="modal" bind:this={dialog} onclose={onclose}>
  <div class="modal-card">
    <h3>{i18n.t('reportTitle')}</h3>
    <p class="modal-hint">
      {i18n.t('reportDesc')}
      {#if target}
        — {safeDisplayName(target.player, i18n.t('hiddenPlayer'))}
      {/if}
    </p>

    <label class="setting-row">
      <span>{i18n.t('reportReason')}</span>
      <select bind:value={reason}>
        <option value="offensive_name">{i18n.t('reportOffensive')}</option>
        <option value="impersonation">{i18n.t('reportImpersonation')}</option>
        <option value="spam_other">{i18n.t('reportSpam')}</option>
      </select>
    </label>

    <label class="report-details-label">
      <span>{i18n.t('reportDetails')}</span>
      <textarea maxlength="250" rows="4" bind:value={details}></textarea>
    </label>

    {#if error}
      <p class="modal-error" role="alert">{error}</p>
    {/if}

    <div class="modal-actions">
      <button class="btn btn-primary" type="button" disabled={busy} onclick={send}>
        {i18n.t('reportSubmit')}
      </button>
      <button class="btn btn-ghost" type="button" onclick={onclose}>{i18n.t('close')}</button>
    </div>
  </div>
</dialog>
