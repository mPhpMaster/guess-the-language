<script lang="ts">
  import type { ModeId } from '$lib/game/types';
  import type { TextKey } from '$lib/i18n/index.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
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
    busy: boolean;
    /** Today's daily challenge has already been submitted. */
    dailyDone: boolean;
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
    busy,
    dailyDone
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
</script>

<section class="screen active" id="screen-home">
  <button class="corner-btn about-btn" type="button" title="About" onclick={onabout}>ⓘ</button>

  <div class="lang-switch">
    <button type="button" class:active={i18n.lang === 'en'} onclick={() => (i18n.lang = 'en')}>EN</button>
    <button type="button" class:active={i18n.lang === 'ar'} onclick={() => (i18n.lang = 'ar')}>ع</button>
  </div>

  <h1 class="home-title" tabindex="-1"><span class="neon">{i18n.t('appTitle')}</span></h1>
  <p class="home-sub">{i18n.t('homeSub')}</p>

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
    <button class="btn btn-primary" id="btn-start" type="button" disabled={busy} onclick={onstart}>
      {busy ? i18n.t('loading') : i18n.t('start')}
    </button>
    <button class="btn btn-daily" class:is-done={dailyDone} type="button" disabled={busy} onclick={ondaily}>
      🗓️ {dailyDone ? i18n.t('dailyPlayed') : i18n.t('dailyChallenge')}
    </button>

    <div class="home-actions-row">
      <button class="btn btn-sm" type="button" onclick={onpractice}>{i18n.t('practiceMode')}</button>
      <button class="btn btn-sm" type="button" onclick={onleaderboard}>{i18n.t('friends')}</button>
      <button class="btn btn-sm" type="button" onclick={onsettings}>{i18n.t('settings')}</button>
    </div>
  </div>

  {#if best > 0}
    <p class="menu-highscore">{i18n.t('bestScore')} <strong>{best}</strong></p>
  {/if}

  {#if settings.name}
    <p class="menu-highscore">{settings.name}</p>
  {/if}
</section>
