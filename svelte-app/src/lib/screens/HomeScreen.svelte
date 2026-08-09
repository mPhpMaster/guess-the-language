<script lang="ts">
  import type { ModeId } from '$lib/game/types';
  import type { TextKey } from '$lib/i18n/index.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { discordAvatarUrl, discordProfile } from '$lib/services/discord.svelte';
  import {
    auth,
    discordLoginAvailable,
    requiresDiscordLogin,
    startDiscordLogin
  } from '$lib/services/discordLogin.svelte';
  import { highScore, settings } from '$lib/state/settings.svelte';

  interface Props {
    mode: ModeId;
    onselect: (mode: ModeId) => void;
    onstart: () => void;
    ondaily: () => void;
    onpractice: () => void;
    onleaderboard: () => void;
    onsettings: () => void;
    onabout: () => void;
    onhost: () => void;
    onjoin: () => void;
    busy: boolean;
    /** Today's daily challenge has already been submitted. */
    dailyDone: boolean;
    /** Host/Join are hidden inside Discord, where rooms are automatic. */
    mpAvailable: boolean;
    mpError: string | null;
    /** Shows the admin entry point. Server-side checks are the real gate. */
    admin: boolean;
    onadmin: () => void;
    /** Opens the player's own profile card. */
    onprofile: () => void;
  }

  let {
    mode,
    onselect,
    onstart,
    ondaily,
    onpractice,
    onleaderboard,
    onsettings,
    onabout,
    onhost,
    onjoin,
    busy,
    dailyDone,
    mpAvailable,
    mpError,
    admin,
    onadmin,
    onprofile
  }: Props = $props();

  /** Card metadata: id, icon, the CSS modifier and the two i18n keys. */
  const CARDS: ReadonlyArray<{
    id: ModeId;
    icon: string;
    modifier: string;
    nameKey: TextKey;
    descKey: TextKey;
  }> = [
    { id: 'languages', icon: '💻', modifier: '', nameKey: 'modeLanguages', descKey: 'modeLanguagesDesc' },
    { id: 'cybersecurity', icon: '🛡️', modifier: 'mode-card-cyber', nameKey: 'modeCyber', descKey: 'modeCyberDesc' },
    { id: 'devops', icon: '⚙️', modifier: 'mode-card-devops', nameKey: 'modeDevops', descKey: 'modeDevopsDesc' },
    { id: 'network', icon: '🌐', modifier: 'mode-card-network', nameKey: 'modeNetwork', descKey: 'modeNetworkDesc' },
    { id: 'gamedev', icon: '🎮', modifier: 'mode-card-gamedev', nameKey: 'modeGamedev', descKey: 'modeGamedevDesc' },
    { id: 'algorithms', icon: '🧩', modifier: 'mode-card-algo', nameKey: 'modeAlgo', descKey: 'modeAlgoDesc' },
    { id: 'all', icon: '🎲', modifier: 'mode-card-all', nameKey: 'modeAll', descKey: 'modeAllDesc' }
  ];

  const best = $derived(highScore(mode));

  /** Sign-in gate — only ever true on the plain web build. */
  const needsLogin = $derived.by(() => {
    auth.revision;
    return requiresDiscordLogin();
  });
  const profile = $derived.by(() => {
    auth.revision;
    return discordProfile();
  });
  const avatar = $derived(discordAvatarUrl(profile, 64));
</script>

<section class="screen active" id="screen-home">
  <button class="corner-btn about-btn" type="button" title="About" onclick={onabout}>ⓘ</button>

  <div class="lang-switch">
    <button type="button" class:active={i18n.lang === 'en'} onclick={() => (i18n.lang = 'en')}>EN</button>
    <button type="button" class:active={i18n.lang === 'ar'} onclick={() => (i18n.lang = 'ar')}>ع</button>
  </div>

  <h1 class="home-title" tabindex="-1"><span class="neon">{i18n.t('appTitle')}</span></h1>
  <p class="home-sub">{i18n.t('homeSub')}</p>

  {#if settings.name || profile}
    <button class="home-profile is-clickable" type="button" onclick={onprofile}>
      {#if avatar}
        <img class="home-profile-avatar" src={avatar} alt="" referrerpolicy="no-referrer" />
      {/if}
      <span class="home-profile-name">{settings.name || profile?.name}</span>
    </button>
  {/if}

  {#if needsLogin}
    <p class="auth-hint">{i18n.t('webAuthHint')}</p>
  {/if}

  {#if auth.error}
    <div class="auth-error" role="alert">
      <span>{i18n.t(auth.error as TextKey)}</span>
      {#if discordLoginAvailable()}
        <button class="text-btn" type="button" onclick={startDiscordLogin}>{i18n.t('retry')}</button>
      {/if}
    </div>
  {/if}

  <div class="mode-grid" role="group" aria-label="Game mode">
    {#each CARDS as card (card.id)}
      <button
        type="button"
        class="mode-card {card.modifier}"
        class:selected={mode === card.id}
        aria-pressed={mode === card.id}
        onclick={() => onselect(card.id)}
      >
        <div class="mode-icon">{card.icon}</div>
        <div class="mode-name">{i18n.t(card.nameKey)}</div>
        <div class="mode-desc">{i18n.t(card.descKey)}</div>
      </button>
    {/each}
  </div>

  <div class="home-actions">
    <!--
      Everything that publishes a score needs an identity, so it waits on the
      sign-in gate. Practice stays open: it is local-only and never reaches the
      leaderboard, which is also why it skips the name check.

      Start is not disabled while signed out — it *becomes* the sign-in, so the
      primary button always does the next useful thing instead of going dead with
      no explanation.
    -->
    <button
      class="btn btn-primary"
      id="btn-start"
      type="button"
      disabled={busy}
      onclick={needsLogin ? startDiscordLogin : onstart}
    >
      {busy ? i18n.t('loading') : needsLogin ? i18n.t('loginDiscordToPlay') : i18n.t('start')}
    </button>
    <button
      class="btn btn-daily"
      class:is-done={dailyDone}
      type="button"
      disabled={busy || needsLogin}
      onclick={ondaily}
    >
      🗓️ {dailyDone ? i18n.t('dailyPlayed') : i18n.t('dailyChallenge')}
    </button>

    {#if mpAvailable}
      <div class="home-mp-actions">
        <button class="btn btn-sm" type="button" disabled={busy || needsLogin} onclick={onhost}>
          {i18n.t('hostRoom')}
        </button>
        <button class="btn btn-sm" type="button" disabled={busy || needsLogin} onclick={onjoin}>
          {i18n.t('joinRoom')}
        </button>
      </div>
    {/if}

    <div class="home-actions-row">
      <button class="btn btn-sm" type="button" onclick={onpractice}>{i18n.t('practiceMode')}</button>
      <button class="btn btn-sm" type="button" onclick={onleaderboard}>{i18n.t('friends')}</button>
      <button class="btn btn-sm" type="button" onclick={onsettings}>{i18n.t('settings')}</button>
      {#if admin}
        <button class="btn btn-sm" type="button" onclick={onadmin}>{i18n.t('adminButton')}</button>
      {/if}
    </div>

    {#if mpError}
      <p class="auth-error" role="alert">{mpError}</p>
    {/if}
  </div>

  {#if best > 0}
    <p class="menu-highscore">{i18n.t('bestScore')} <strong>{best}</strong></p>
  {/if}
</section>
