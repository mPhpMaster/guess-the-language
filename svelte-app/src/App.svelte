<script lang="ts">
  import AchievementPop from '$lib/components/AchievementPop.svelte';
  import AdminPanel from '$lib/components/AdminPanel.svelte';
  import JoinRoomDialog from '$lib/components/JoinRoomDialog.svelte';
  import ProfileCard from '$lib/components/ProfileCard.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import { dailyDateKey } from '$lib/game/round';
  import type { ModeId } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { room } from '$lib/multiplayer/room.svelte';
  import { mpSession } from '$lib/multiplayer/session.svelte';
  import GameScreen from '$lib/screens/GameScreen.svelte';
  import HomeScreen from '$lib/screens/HomeScreen.svelte';
  import LobbyScreen from '$lib/screens/LobbyScreen.svelte';
  import MpGameScreen from '$lib/screens/MpGameScreen.svelte';
  import MpResultsScreen from '$lib/screens/MpResultsScreen.svelte';
  import ResultsScreen from '$lib/screens/ResultsScreen.svelte';
  import { discord, discordProfile, ready as discordReady } from '$lib/services/discord.svelte';
  import { isAdmin } from '$lib/services/admin';
  import { setLogContextProvider } from '$lib/services/errors';
  import { fetchPersonalRank, submitDailyScore, submitScore } from '$lib/services/leaderboard';
  import { markRoundStart, pushPresence, startHeartbeat, type ScreenName } from '$lib/services/presence';
  import { recordPlay } from '$lib/services/profile';
  import { supabaseConfigured } from '$lib/services/supabase';
  import { game } from '$lib/state/game.svelte';
  import { isDailyDone, markDailyDone, settings } from '$lib/state/settings.svelte';

  type Screen = 'home' | 'game' | 'results';

  let screen = $state<Screen>('home');
  let mode = $state<ModeId>('all');
  let busy = $state(false);
  let settingsOpen = $state(false);
  let adminOpen = $state(false);
  let joinOpen = $state(false);
  let joinBusy = $state(false);
  let mpError = $state<string | null>(null);
  let personalRank = $state<number | null>(null);
  let profileName = $state<string | null>(null);
  let profileAvatar = $state<string | null>(null);
  let unlockedAchievements = $state<string[]>([]);
  /** Wall-clock start of the current round, for the "seconds played" stat. */
  let roundStartedAtMs = Date.now();

  // Keep <html lang/dir> in step with the language so the whole app flips to RTL.
  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });

  setLogContextProvider(() => ({ mode: game.mode, screen, player: settings.name || null }));

  /**
   * Adopt the Discord identity as the leaderboard name once the handshake
   * settles — inside the Activity the player has no other way to set it.
   */
  $effect(() => {
    void discordReady.then(() => {
      const profile = discordProfile();
      if (profile?.name && !settings.name) settings.setName(profile.name);
    });
  });

  // ---- multiplayer lifecycle ----

  /** Which multiplayer view the room status maps to; null when solo. */
  const mpView = $derived.by<'lobby' | 'game' | 'results' | null>(() => {
    if (!room.online) return null;
    if (room.status === 'playing') return 'game';
    if (room.status === 'finished' || room.status === 'closed') return 'results';
    return 'lobby';
  });

  // ---- presence ----

  /** The screen name presence and the heartbeat report. */
  const presenceScreen = $derived<ScreenName>(
    mpView === 'lobby' ? 'lobby' : mpView === 'results' ? 'results' : mpView === 'game' ? 'game' : screen
  );

  // Refresh the Discord profile card on every meaningful change. The SDK layer
  // coalesces these, so firing on each question or score change is safe.
  $effect(() => {
    pushPresence({
      screen: presenceScreen,
      mode: game.mode,
      score: game.score,
      current: Math.min(game.index + 1, game.total),
      total: game.total,
      enabled: settings.discordPresence
    });
  });

  // Feeds the admin "who's playing right now" view.
  $effect(() =>
    startHeartbeat(() => ({ player: settings.name.trim(), screen: presenceScreen, mode: game.mode }))
  );

  // Load the room's banks and run the derived clock only while a round is live.
  $effect(() => {
    if (mpView === 'game') {
      void mpSession.loadPool();
      mpSession.start();
      return () => mpSession.stop();
    }
  });

  // Being removed from a room drops the player back home with a message.
  $effect(() => {
    if (room.kicked) {
      mpError = i18n.t('mpKicked');
      room.teardown();
      screen = 'home';
    }
  });

  // A page close/refresh mid-room would otherwise leave a zombie player behind.
  $effect(() => {
    const onUnload = () => room.leaveBeacon();
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  });

  // The solo round ends inside the engine; react to that rather than making
  // every call site remember to switch screens.
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
      // record_progress awards XP, updates the daily streak and unlocks
      // achievements server-side, returning whatever was newly earned.
      unlockedAchievements = await recordPlay({
        player,
        seconds: Math.round((Date.now() - roundStartedAtMs) / 1000),
        multiplayer: false,
        won: false,
        xp: game.score,
        perfect: game.total > 0 && game.correct === game.total
      });
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
      roundStartedAtMs = Date.now();
      markRoundStart();
      screen = 'game';
    } catch (err) {
      console.error('failed to start round:', err);
    } finally {
      busy = false;
    }
  }

  function roomSettings() {
    return { questions: settings.questions, difficulty: settings.difficulty, timer: settings.timer };
  }

  function playerName(): string {
    return settings.name.trim() || discordProfile()?.name || 'Player';
  }

  async function hostRoom(): Promise<void> {
    mpError = null;
    if (!room.configured()) {
      mpError = i18n.t('mpNeedOnline');
      return;
    }
    busy = true;
    try {
      await room.host(mode, roomSettings(), playerName());
    } catch (err) {
      mpError = err instanceof Error ? err.message : i18n.t('mpHostFail');
    } finally {
      busy = false;
    }
  }

  async function joinRoom(code: string): Promise<void> {
    mpError = null;
    joinBusy = true;
    try {
      await room.join(code, playerName());
      joinOpen = false;
    } catch (err) {
      mpError = err instanceof Error ? err.message : i18n.t('mpJoinFail');
    } finally {
      joinBusy = false;
    }
  }

  async function leaveRoom(): Promise<void> {
    await room.leave();
    mpSession.stop();
    screen = 'home';
  }

  function goHome(): void {
    game.abort();
    screen = 'home';
  }
</script>

<main id="app-main">
  {#if mpView === 'lobby'}
    <LobbyScreen onleave={leaveRoom} />
  {:else if mpView === 'game'}
    <MpGameScreen onleave={leaveRoom} />
  {:else if mpView === 'results'}
    <MpResultsScreen onleave={leaveRoom} />
  {:else if screen === 'home'}
    <HomeScreen
      {mode}
      {busy}
      dailyDone={isDailyDone(dailyDateKey())}
      mpAvailable={room.configured() && !discord.embedded}
      {mpError}
      onselect={(m) => (mode = m)}
      onstart={() => start()}
      ondaily={() => start({ daily: true })}
      onpractice={() => start({ practice: true })}
      onhost={hostRoom}
      onjoin={() => (joinOpen = true)}
      onleaderboard={() => (screen = 'results')}
      admin={isAdmin()}
      onadmin={() => (adminOpen = true)}
      onsettings={() => (settingsOpen = true)}
      onabout={() => (settingsOpen = true)}
    />
  {:else if screen === 'game'}
    <GameScreen onend={goHome} />
  {:else}
    <ResultsScreen
      {personalRank}
      onreplay={() => start()}
      onhome={goHome}
      onprofile={(name, avatar) => {
        profileName = name;
        profileAvatar = avatar;
      }}
    />
  {/if}
</main>

<div class="sr-only" role="status" aria-live="polite" id="app-live-region"></div>

<ProfileCard
  name={profileName}
  avatar={profileAvatar}
  onclose={() => {
    profileName = null;
    profileAvatar = null;
  }}
/>
<AchievementPop ids={unlockedAchievements} onclear={() => (unlockedAchievements = [])} />

<AdminPanel open={adminOpen} onclose={() => (adminOpen = false)} />

<SettingsDialog open={settingsOpen} onclose={() => (settingsOpen = false)} />
<JoinRoomDialog
  open={joinOpen}
  busy={joinBusy}
  error={mpError}
  onjoin={joinRoom}
  onclose={() => (joinOpen = false)}
/>
