<script lang="ts">
  import AboutDialog from '$lib/components/AboutDialog.svelte';
  import AchievementPop from '$lib/components/AchievementPop.svelte';
  import AdminPanel from '$lib/components/AdminPanel.svelte';
  import ChallengeBanner from '$lib/components/ChallengeBanner.svelte';
  import ShareOverlay from '$lib/components/ShareOverlay.svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';
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
  import { ensureValidPlayerName, nameProblemKey } from '$lib/services/playerName';
  import { markRoundStart, pushPresence, startHeartbeat, type ScreenName } from '$lib/services/presence';
  import { recordPlay } from '$lib/services/profile';
  import {
    buildChallengePayload,
    buildChallengeUrl,
    getChallengeFromUrl,
    type Challenge
  } from '$lib/game/challenge';
  import { renderShareCard, uploadShareCard } from '$lib/services/share';
  import { supabaseConfigured } from '$lib/services/supabase';
  import { game } from '$lib/state/game.svelte';
  import { isDailyDone, markDailyDone, settings } from '$lib/state/settings.svelte';
  import { uiScale } from '$lib/state/uiScale.svelte';

  type Screen = 'home' | 'game' | 'results';

  let screen = $state<Screen>('home');
  let mode = $state<ModeId>('all');
  let busy = $state(false);
  let settingsOpen = $state(false);
  let adminOpen = $state(false);
  let aboutOpen = $state(false);
  let joinOpen = $state(false);
  let joinBusy = $state(false);
  let mpError = $state<string | null>(null);
  /** Rejection reason from the name gate, shown on the home screen. */
  let nameError = $state<string | null>(null);
  /** Last name that passed the gate, so re-using it skips the online checks. */
  let acceptedName = '';
  let personalRank = $state<number | null>(null);
  let profileName = $state<string | null>(null);
  let profileAvatar = $state<string | null>(null);
  let unlockedAchievements = $state<string[]>([]);
  /** Wall-clock start of the current round, for the "seconds played" stat. */
  let roundStartedAtMs = Date.now();

  // ---- share & challenge ----
  /** Read once from the URL; the reactive copy below only drives the banner. */
  const launchChallenge = getChallengeFromUrl();
  let challenge = $state<Challenge | null>(launchChallenge);
  /** Score to beat, captured when the round that answers a challenge starts. */
  let challengeTarget = $state<number | null>(null);
  let challengeLink = $state<string | null>(null);
  let shareBusy = $state(false);
  let shareUrl = $state<string | null>(null);
  let shareBlob = $state<Blob | null>(null);
  let sharePublicUrl = $state<string | null>(null);

  // Apply the interface scale, and keep auto-fit tracking window resizes.
  $effect(() => {
    uiScale.apply();
  });
  $effect(() => uiScale.watchResize());

  // Keep <html lang/dir> in step with the language so the whole app flips to RTL.
  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });

  /**
   * A challenged friend launches with the challenger's settings preset.
   *
   * Deliberately NOT an `$effect`: `settings.update()` reads the same state it
   * writes, so running it inside an effect makes the effect depend on its own
   * write and loop until Svelte throws effect_update_depth_exceeded. This is a
   * one-shot bootstrap from the URL, so it belongs in component init.
   */
  if (launchChallenge) {
    if (launchChallenge.mode) mode = launchChallenge.mode;
    settings.update({
      ...(launchChallenge.questions ? { questions: launchChallenge.questions } : {}),
      ...(launchChallenge.difficulty ? { difficulty: launchChallenge.difficulty } : {})
    });
  }

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
    nameError = null;
    try {
      // Practice is local-only, so it does not require a leaderboard name.
      if (!opts.practice) {
        const check = await ensureValidPlayerName({ candidate: settings.name, previous: acceptedName });
        if (!check.valid) {
          nameError = i18n.t(nameProblemKey(check.problem!));
          settingsOpen = true;
          return;
        }
        acceptedName = check.name;
        if (check.name !== settings.name) settings.setName(check.name);
      }

      // Only a solo round in the challenged mode counts as answering it.
      challengeTarget =
        challenge && !opts.practice && !opts.daily && challenge.score != null && challenge.mode === mode
          ? challenge.score
          : null;
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
      const check = await ensureValidPlayerName({ candidate: settings.name, previous: acceptedName });
      if (!check.valid) {
        nameError = i18n.t(nameProblemKey(check.problem!));
        settingsOpen = true;
        return;
      }
      acceptedName = check.name;
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

  async function shareCard(): Promise<void> {
    if (shareBusy) return;
    shareBusy = true;
    try {
      const blob = await renderShareCard({
        score: game.score,
        correct: game.correct,
        total: game.total,
        player: settings.name,
        daily: game.daily,
        mode: game.mode
      });
      if (!blob) return;
      shareBlob = blob;
      shareUrl = URL.createObjectURL(blob);
      // Uploading is what makes sharing possible inside Discord, where the
      // clipboard and downloads are blocked. A failure is not fatal.
      sharePublicUrl = await uploadShareCard(blob).catch(() => null);
    } catch (err) {
      console.error('share card failed:', err);
    } finally {
      shareBusy = false;
    }
  }

  function closeShare(): void {
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = null;
    shareBlob = null;
    sharePublicUrl = null;
  }

  async function challengeFriend(): Promise<void> {
    const payload = buildChallengePayload({
      mode: game.mode,
      difficulty: settings.difficulty,
      questions: settings.questions,
      score: game.score
    });
    const url = buildChallengeUrl(payload);
    challengeLink = url;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked — the link is shown as selectable text instead.
    }
  }

  function goHome(): void {
    game.abort();
    screen = 'home';
  }
</script>

<TitleBar />

<main id="app-main">
  {#if mpView === 'lobby'}
    <LobbyScreen onleave={leaveRoom} />
  {:else if mpView === 'game'}
    <MpGameScreen onleave={leaveRoom} />
  {:else if mpView === 'results'}
    <MpResultsScreen onleave={leaveRoom} />
  {:else if screen === 'home'}
    <ChallengeBanner {challenge} ondismiss={() => (challenge = null)} />
    <HomeScreen
      {mode}
      {busy}
      dailyDone={isDailyDone(dailyDateKey())}
      mpAvailable={room.configured() && !discord.embedded}
      mpError={mpError ?? nameError}
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
      onabout={() => (aboutOpen = true)}
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
      {challengeTarget}
      {shareBusy}
      {challengeLink}
      onshare={shareCard}
      onchallenge={challengeFriend}
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

<ShareOverlay
  objectUrl={shareUrl}
  blob={shareBlob}
  publicUrl={sharePublicUrl}
  message={i18n.challengeText(game.score)}
  onclose={closeShare}
/>

<AboutDialog open={aboutOpen} onclose={() => (aboutOpen = false)} />

<AdminPanel open={adminOpen} onclose={() => (adminOpen = false)} />

<SettingsDialog open={settingsOpen} onclose={() => (settingsOpen = false)} />
<JoinRoomDialog
  open={joinOpen}
  busy={joinBusy}
  error={mpError}
  onjoin={joinRoom}
  onclose={() => (joinOpen = false)}
/>
