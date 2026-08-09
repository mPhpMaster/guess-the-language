<script lang="ts">
  import type { DifficultyFilter } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { discord, inDiscordEmbed } from '$lib/services/discord.svelte';
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
   * Can this platform obtain a Discord identity at all?
   *
   * Everywhere it can — the web build and inside the Activity — there is no
   * free-text name field: the identity is Discord's, so a typed name would only
   * ever be a nickname that the sign-in immediately overwrites.
   *
   * Electron is the exception and keeps the field. It is served from `file://`,
   * which cannot be a registered OAuth redirect target, so no Discord sign-in is
   * possible there — without a field the desktop build would have no identity
   * and could not start a round at all.
   */
  const discordIsPossible = $derived.by(() => {
    auth.revision;
    return discord.active || inDiscordEmbed() || discordLoginAvailable() || !!webProfile();
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

  {#if discordIsPossible}
    <!-- Identity is Discord's. Show it, never offer to edit it. -->
    {#if settings.name}
      <div class="setting-row">
        <span>{i18n.t('settingName')}</span>
        <strong>{settings.name}</strong>
      </div>
    {/if}
    <p class="discord-name-note">{i18n.t('discordNameNote')}</p>
  {:else}
    <label class="setting-row">
      <span>{i18n.t('settingName')}</span>
      <input
        type="text"
        value={settings.name}
        maxlength="24"
        oninput={(e) => settings.setName(e.currentTarget.value)}
      />
    </label>
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
