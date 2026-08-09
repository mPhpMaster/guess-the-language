import { normFill, normalizeQuestion } from '$lib/game/round';
import type { Question, RawQuestion } from '$lib/game/types';
import { i18n } from '$lib/i18n/index.svelte';
import { getQuestions } from '$lib/services/questions';
import { resolveQuestion, remainingSeconds } from './round';
import { room } from './room.svelte';
import type { RoomAnswerRow } from './types';

/**
 * The multiplayer round as the local player experiences it.
 *
 * The room store mirrors server truth; this layer turns the current
 * `question_index` into a rendered question, remembers the local pick, and
 * exposes the reveal. It deliberately owns no clock — `timeLeft` is derived from
 * the server's `question_ends_at`, so every client counts down to the same
 * instant instead of drifting on its own interval.
 */
class MpSession {
  /** Question banks for the room's mode, loaded when the room starts. */
  #pool = $state<RawQuestion[]>([]);
  /** The answer the local player has locked in for the current question. */
  chosen = $state<string | null>(null);
  /** Ticks once a second purely to re-derive `timeLeft`. */
  #now = $state(Date.now());
  #clock: ReturnType<typeof setInterval> | null = null;
  /** Per-player answers for the question being revealed. */
  revealAnswers = $state<RoomAnswerRow[]>([]);

  current = $derived.by<Question | null>(() => {
    const ref = room.roundRefs[room.questionIndex];
    if (!ref || !this.#pool.length) return null;
    const raw = resolveQuestion(ref, this.#pool);
    if (!raw) return null;
    return normalizeQuestion(raw, {
      optionSeed: ref.optionSeed,
      languagePrompt: i18n.t('langPrompt'),
      fillPrompt: i18n.t('fillPrompt'),
      pick: i18n.pick
    });
  });

  total = $derived(room.roundRefs.length);
  index = $derived(room.questionIndex);
  isReveal = $derived(room.phase === 'reveal');
  /** Seconds until the server's deadline for this question. */
  timeLeft = $derived.by(() => {
    void this.#now; // re-derive every tick
    return remainingSeconds(room.room?.question_ends_at);
  });
  questionTime = $derived(room.roundRefs[room.questionIndex]?.duration ?? 15);
  /** Spectators watch only — their picks never count. */
  canAnswer = $derived(!room.amSpectator && room.phase === 'question' && this.chosen === null);
  /** True once the local player has submitted and is waiting for the reveal. */
  waiting = $derived(!room.amSpectator && this.chosen !== null && room.phase === 'question');

  /** The correct answer, known only once the server flips to reveal. */
  correctAnswer = $derived(this.isReveal ? (this.current?.answer ?? null) : null);

  start(): void {
    this.#clock ??= setInterval(() => {
      this.#now = Date.now();
    }, 250);
  }

  stop(): void {
    if (this.#clock !== null) {
      clearInterval(this.#clock);
      this.#clock = null;
    }
    this.chosen = null;
    this.revealAnswers = [];
  }

  async loadPool(): Promise<void> {
    const mode = room.room?.mode ?? 'all';
    this.#pool = await getQuestions(mode);
  }

  /** Clear the local pick when the room moves to a new question. */
  onQuestionChanged(): void {
    this.chosen = null;
    this.revealAnswers = [];
  }

  /**
   * Submit a pick. The answer may be changed as often as the player likes while
   * the question is open — the server keeps the latest and scores at reveal.
   */
  async submit(answer: string): Promise<void> {
    if (room.amSpectator || room.phase !== 'question') return;
    const isFill = this.current?.style === 'fill';
    this.chosen = answer;
    try {
      await room.submitAnswer(isFill ? normFill(answer) : answer, this.timeLeft);
    } catch (err) {
      console.error('submit_answer:', err);
    }
  }

  /** Pull everyone's answers so the reveal can show who picked what. */
  async loadReveal(): Promise<void> {
    try {
      this.revealAnswers = await room.fetchAnswers(room.questionIndex);
    } catch {
      this.revealAnswers = [];
    }
  }
}

export const mpSession = new MpSession();
