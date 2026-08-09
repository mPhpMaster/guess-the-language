<script lang="ts">
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import type { ModeId } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { setLogContextProvider } from '$lib/services/errors';
  import { fetchPersonalRank, submitDailyScore, submitScore } from '$lib/services/leaderboard';
  import { supabaseConfigured } from '$lib/services/supabase';
  import GameScreen from '$lib/screens/GameScreen.svelte';
  import HomeScreen from '$lib/screens/HomeScreen.svelte';
  import ResultsScreen from '$lib/screens/ResultsScreen.svelte';
  import { dailyDateKey } from '$lib/game/round';
  import { game } from '$lib/state/game.svelte';
  import { isDailyDone, markDailyDone, settings } from '$lib/state/settings.svelte';

  type Screen = 'home' | 'game' | 'results';

  let screen = $state<Screen>('home');
  let mode = $state<ModeId>('all');
  let busy = $state(false);
  let settingsOpen = $state(false);
  let personalRank = $state<number | null>(null);

  // Keep <html lang/dir> in step with the language so the whole app flips to RTL.
  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });

  // Give the error logger enough context to be useful without a circular import.
  setLogContextProvider(() => ({ mode: game.mode, screen, player: settings.name || null }));

  // The round ends inside the engine (timeout on the last question, or the last
  // "Next"); this reacts to that rather than every call site remembering to.
  $effect(() => {
    if (game.phase === 'finished' && screen === 'game') {
      screen = 'results';
      void reportScore();
    }
  });

  async function reportScore(): Promise<void> {
    personalRank = null;
    if (!supabaseConfigured() || game.practice || game.score <= 0) return;
    const player = settings.name.trim();
    if (!player) return; // anonymous rounds are not published

    const hiddenLabel = i18n.t('hiddenPlayer');
    try {
      if (game.daily) {
        await submitDailyScore(player, game.score, hiddenLabel);
        markDailyDone(dailyDateKey());
      } else {
        await submitScore({ player, score: game.score, mode: game.mode, hiddenLabel });
        personalRank = await fetchPersonalRank(game.mode, 'all', game.score);
      }
    } catch (err) {
      // A leaderboard outage must never interrupt the results screen.
      console.error('score submit failed:', err);
    }
  }

  async function start(opts: { practice?: boolean; daily?: boolean } = {}): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await game.startRound(opts.daily ? 'all' : mode, opts);
      screen = 'game';
    } catch (err) {
      console.error('failed to start round:', err);
    } finally {
      busy = false;
    }
  }

  function goHome(): void {
    game.abort();
    screen = 'home';
  }
</script>

<main id="app-main">
  {#if screen === 'home'}
    <HomeScreen
      {mode}
      {busy}
      onselect={(m) => (mode = m)}
      onstart={() => start()}
      dailyDone={isDailyDone(dailyDateKey())}
      ondaily={() => start({ daily: true })}
      onpractice={() => start({ practice: true })}
      onleaderboard={() => {
        // The board lives on the results card; open it with an empty round.
        screen = 'results';
      }}
      onsettings={() => (settingsOpen = true)}
      onabout={() => (settingsOpen = true)}
    />
  {:else if screen === 'game'}
    <GameScreen onend={goHome} />
  {:else}
    <ResultsScreen {personalRank} onreplay={() => start()} onhome={goHome} />
  {/if}
</main>

<div class="sr-only" role="status" aria-live="polite" id="app-live-region"></div>

<SettingsDialog open={settingsOpen} onclose={() => (settingsOpen = false)} />
