<script lang="ts">
  import CodePanel from '$lib/components/CodePanel.svelte';
  import FillForm from '$lib/components/FillForm.svelte';
  import MpPlayerList from '$lib/components/MpPlayerList.svelte';
  import OptionsGrid from '$lib/components/OptionsGrid.svelte';
  import TimerRing from '$lib/components/TimerRing.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { room } from '$lib/multiplayer/room.svelte';
  import { mpSession } from '$lib/multiplayer/session.svelte';

  interface Props {
    onleave: () => void;
  }

  let { onleave }: Props = $props();

  const question = $derived(mpSession.current);

  // Reset the local pick whenever the server moves to a new question, and pull
  // everyone's answers once it flips to the reveal.
  $effect(() => {
    void mpSession.index;
    mpSession.onQuestionChanged();
  });

  $effect(() => {
    if (mpSession.isReveal) void mpSession.loadReveal();
  });
</script>

<section class="screen active" id="screen-game">
  <h2 class="sr-only screen-heading" tabindex="-1">{i18n.t('gameTitle')}</h2>

  <div class="mp-game-strip">
    {#if room.code}<span class="mp-room-code-pill">{room.code}</span>{/if}
    <MpPlayerList players={room.players} compact />
  </div>

  <div class="game-topbar">
    <div class="topbar-left">
      <div class="score-pill"><span>{i18n.t('score')}</span> <span>{room.me?.score ?? 0}</span></div>
    </div>
    <div class="topbar-right">
      <div class="progress-pill">
        <span>{i18n.t('question')}</span>
        <span>{Math.min(mpSession.index + 1, mpSession.total)}</span> / <span>{mpSession.total}</span>
      </div>
      {#if room.isHost}
        <button class="end-btn" type="button" onclick={() => room.end()}>{i18n.t('endRoom')}</button>
      {/if}
      <!-- Spectators get their own exit: the End button is host-only, so without
           this they would be stuck in the room until the round finished. -->
      {#if room.amSpectator}
        <button class="end-btn" type="button" onclick={onleave}>{i18n.t('leaveRoom')}</button>
      {/if}
    </div>
  </div>

  {#if room.amSpectator}
    <div class="mp-status">{i18n.t('spectating')}</div>
  {/if}

  {#if question}
    <div class="game-body">
      <div class="code-wrap">
        <CodePanel
          text={question.panelText}
          isCode={question.panelIsCode}
          difficulty={question.difficulty}
          difficultyLabel={i18n.diffLabel(question.difficulty)}
        />
      </div>
      <TimerRing
        fraction={mpSession.questionTime ? mpSession.timeLeft / mpSession.questionTime : 0}
        seconds={mpSession.timeLeft}
      />
    </div>

    {#if question.questionText}
      <div class="question-text" dir="auto">{question.questionText}</div>
    {/if}

    {#if mpSession.waiting}
      <div class="mp-status">{i18n.t('waitingOpponents')}</div>
    {/if}

    {#if question.style === 'fill'}
      <FillForm
        answered={room.amSpectator || mpSession.isReveal}
        verdict={mpSession.isReveal && mpSession.chosen
          ? mpSession.chosen === question.answer
            ? 'correct'
            : 'wrong'
          : null}
        onsubmit={(typed) => mpSession.submit(typed)}
      />
    {:else}
      <!-- During the question the pick is only highlighted; correctness stays
           hidden until the server flips to the reveal. -->
      <OptionsGrid
        {question}
        answered={mpSession.isReveal || room.amSpectator}
        selected={mpSession.chosen}
        eliminated={[]}
        onpick={(label) => mpSession.submit(label)}
      />
    {/if}
  {:else}
    <div class="mp-status">{i18n.t('lbLoading')}</div>
  {/if}
</section>
