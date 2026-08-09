<script lang="ts">
  import MpPlayerList from '$lib/components/MpPlayerList.svelte';
  import type { DifficultyFilter, ModeId } from '$lib/game/types';
  import { i18n } from '$lib/i18n/index.svelte';
  import { buildRoundForRoom } from '$lib/multiplayer/round';
  import { room } from '$lib/multiplayer/room.svelte';
  import type { RoomSettings } from '$lib/multiplayer/types';
  import { getQuestions } from '$lib/services/questions';
  import { openInviteDialog, discord } from '$lib/services/discord.svelte';
  import { settings, type TimerSetting } from '$lib/state/settings.svelte';

  interface Props {
    onleave: () => void;
  }

  let { onleave }: Props = $props();

  let starting = $state(false);
  let error = $state<string | null>(null);
  let copied = $state(false);

  const roomSettings = $derived(room.room?.settings);
  const mode = $derived<ModeId>(room.room?.mode ?? 'all');

  async function start(): Promise<void> {
    if (starting || !room.isHost) return;
    starting = true;
    error = null;
    try {
      const pool = await getQuestions(mode);
      const { roundRefs, answerKeys } = buildRoundForRoom(pool, {
        mode,
        questions: roomSettings?.questions ?? settings.questions,
        difficulty: roomSettings?.difficulty ?? settings.difficulty,
        timer: roomSettings?.timer ?? settings.timer
      });
      await room.start(roundRefs, answerKeys);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      starting = false;
    }
  }

  /**
   * Push one changed lobby control to the room. Every control sends the full
   * settings object, so the three it did not change have to be carried over from
   * the room rather than from local preferences — otherwise changing the mode
   * would quietly reset the host's question count and timer.
   */
  async function push(patch: { mode?: ModeId } & Partial<RoomSettings>): Promise<void> {
    if (!room.isHost) return;
    try {
      await room.updateSettings(patch.mode ?? mode, {
        questions: patch.questions ?? roomSettings?.questions ?? settings.questions,
        difficulty: patch.difficulty ?? roomSettings?.difficulty ?? settings.difficulty,
        timer: patch.timer ?? roomSettings?.timer ?? settings.timer
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function copyCode(): Promise<void> {
    if (!room.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  }
</script>

<section class="screen active" id="screen-lobby">
  <div class="lobby-card">
    <h2 class="screen-heading" tabindex="-1">{i18n.t('lobbyTitle')}</h2>

    {#if room.code}
      <div class="lobby-code-row">
        <span>{i18n.t('roomCode')}</span>
        <span class="lobby-code">{room.code}</span>
        <button class="btn btn-sm" type="button" onclick={copyCode}>
          {copied ? i18n.t('inviteShareCode') : i18n.t('copyCode')}
        </button>
      </div>
    {/if}

    {#if discord.active}
      <button class="btn btn-sm btn-ghost" type="button" onclick={() => openInviteDialog()}>
        {i18n.t('inviteToRoom')}
      </button>
    {/if}

    {#if room.isHost}
      <h4 class="lobby-settings-title">{i18n.t('lobbySettings')}</h4>

      <label class="setting-row">
        <span>{i18n.t('changeMode')}</span>
        <select value={mode} onchange={(e) => push({ mode: e.currentTarget.value as ModeId })}>
          <option value="languages">{i18n.t('modeLanguages')}</option>
          <option value="cybersecurity">{i18n.t('modeCyber')}</option>
          <option value="devops">{i18n.t('modeDevops')}</option>
          <option value="network">{i18n.t('modeNetwork')}</option>
          <option value="gamedev">{i18n.t('modeGamedev')}</option>
          <option value="algorithms">{i18n.t('modeAlgo')}</option>
          <option value="all">{i18n.t('modeAll')}</option>
        </select>
      </label>

      <label class="setting-row">
        <span>{i18n.t('settingQuestions')}</span>
        <select
          value={String(roomSettings?.questions ?? settings.questions)}
          onchange={(e) => push({ questions: Number(e.currentTarget.value) })}
        >
          {#each [5, 10, 15, 20] as n (n)}
            <option value={String(n)}>{n}</option>
          {/each}
        </select>
      </label>

      <label class="setting-row">
        <span>{i18n.t('settingDifficulty')}</span>
        <select
          value={roomSettings?.difficulty ?? settings.difficulty}
          onchange={(e) => push({ difficulty: e.currentTarget.value as DifficultyFilter })}
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
          value={roomSettings?.timer ?? settings.timer}
          onchange={(e) => push({ timer: e.currentTarget.value as TimerSetting })}
        >
          <option value="auto">{i18n.t('timerAuto')}</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="20">20</option>
          <option value="30">30</option>
        </select>
      </label>
    {/if}

    <MpPlayerList players={room.players} showHostControls />

    {#if error}
      <p class="auth-error">{error}</p>
    {/if}

    <div class="lobby-buttons">
      {#if room.isHost}
        <button class="btn btn-primary" type="button" disabled={starting} onclick={start}>
          {i18n.t('startGame')}
        </button>
      {:else}
        <p class="lb-note">{i18n.t('waitingHost')}</p>
      {/if}
      <button class="btn btn-ghost" type="button" onclick={onleave}>{i18n.t('leaveRoom')}</button>
    </div>
  </div>
</section>
