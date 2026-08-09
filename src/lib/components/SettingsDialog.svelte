<script lang="ts">
  import type { DifficultyFilter } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { discord } from '$lib/services/discord.svelte';
  import {
    auth,
    discordLoginAvailable,
    discordLogout,
    startDiscordLogin,
    webProfile
  } from '$lib/services/discordLogin.svelte';
  import { settings, type FeedbackDelay, type TimerSetting } from '$lib/state/settings.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  const linked = $derived.by(() => {
    auth.revision;
    return webProfile();
  });
  /**
   * Whenever a Discord identity exists — the Activity handshake OR a web
   * sign-in — the name is theirs and is not editable. Only Electron, which has
   * no Discord identity, offers a free-text name.
   */
  const nameFromDiscord = $derived.by(() => {
    auth.revision;
    return discord.active || !!webProfile();
  });

  // Drive the native <dialog> from the `open` prop so focus trapping, Esc and
  // the backdrop all come from the platform rather than being reimplemented.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog class="popover" bind:this={dialog} onclose={onclose}>
  <h3>{i18n.t('settingsTitle')}</h3>

  <label class="setting-row">
    <span>{i18n.t('settingName')}</span>
    <input
      type="text"
      value={settings.name}
      maxlength="24"
      disabled={nameFromDiscord}
      oninput={(e) => settings.setName(e.currentTarget.value)}
    />
  </label>

  {#if nameFromDiscord}
    <p class="discord-name-note">{i18n.t('discordNameNote')}</p>
  {/if}

  <!--
    Web sign-in only. Inside the Activity the identity comes from the SDK, and in
    Electron the file:// origin cannot be an OAuth redirect target — in both cases
    `discordLoginAvailable()` is false and this block never renders.
  -->
  {#if discordLoginAvailable()}
    {#if linked}
      <p class="discord-login-status">{i18n.t('discordLinkedAs')} {linked.name}</p>
      <button class="btn btn-discord-logout btn-sm" type="button" onclick={discordLogout}>
        {i18n.t('logoutDiscord')}
      </button>
    {:else}
      <button class="btn btn-discord btn-sm" type="button" onclick={startDiscordLogin}>
        {i18n.t('loginDiscord')}
      </button>
    {/if}
  {/if}

  <label class="setting-row">
    <span>{i18n.t('settingQuestions')}</span>
    <select
      value={String(settings.questions)}
      onchange={(e) => settings.update({ questions: Number(e.currentTarget.value) })}
    >
      {#each [5, 10, 15, 20] as n (n)}
        <option value={String(n)}>{n}</option>
      {/each}
    </select>
  </label>

  <label class="setting-row">
    <span>{i18n.t('settingDifficulty')}</span>
    <select
      value={settings.difficulty}
      onchange={(e) => settings.update({ difficulty: e.currentTarget.value as DifficultyFilter })}
    >
      <option value="all">{i18n.t('diffAll')}</option>
      <option value="easy">{i18n.diffLabel('easy')}</option>
      <option value="medium">{i18n.diffLabel('medium')}</option>
      <option value="hard">{i18n.diffLabel('hard')}</option>
    </select>
  </label>

  <label class="setting-row">
    <span>{i18n.t('settingTimer')}</span>
    <select
      value={settings.timer}
      onchange={(e) => settings.update({ timer: e.currentTarget.value as TimerSetting })}
    >
      <option value="auto">{i18n.t('timerAuto')}</option>
      <option value="10">10</option>
      <option value="15">15</option>
      <option value="20">20</option>
      <option value="30">30</option>
    </select>
  </label>

  <label class="setting-row">
    <span>{i18n.t('settingFeedbackDelay')}</span>
    <select
      value={String(settings.feedbackDelay)}
      onchange={(e) => settings.update({ feedbackDelay: Number(e.currentTarget.value) as FeedbackDelay })}
    >
      <option value="2">{i18n.t('feedback2')}</option>
      <option value="4">{i18n.t('feedback4')}</option>
      <option value="6">{i18n.t('feedback6')}</option>
      <option value="0">{i18n.t('feedbackManual')}</option>
    </select>
  </label>

  <label class="setting-row">
    <span>{i18n.t('settingSound')}</span>
    <input
      type="checkbox"
      checked={settings.sound}
      onchange={(e) => settings.update({ sound: e.currentTarget.checked })}
    />
  </label>

  <label class="setting-row">
    <span>{i18n.t('settingAdaptive')}</span>
    <input
      type="checkbox"
      checked={settings.adaptive}
      onchange={(e) => settings.update({ adaptive: e.currentTarget.checked })}
    />
  </label>

  <button class="btn btn-primary" type="button" onclick={onclose}>{i18n.t('close')}</button>
</dialog>
