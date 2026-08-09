import { AdaptivePicker } from '$lib/game/adaptive';
import {
  buildDailyRound,
  buildRoundFromPool,
  isFillCorrect,
  normFill,
  normalizeQuestion,
  scoreAnswer,
  shuffle,
  timeForDifficulty
} from '$lib/game/round';
import type { ModeId, Question, RawQuestion, RoundAnswer } from '$lib/game/types';
import { i18n } from '$lib/i18n/index.svelte';
import { sfx } from '$lib/services/audio';
import { getQuestions } from '$lib/services/questions';
import { highScore, setHighScore, settings } from './settings.svelte';

export type GamePhase = 'idle' | 'question' | 'feedback' | 'finished';

export interface Feedback {
  kind: 'good' | 'bad';
  headline: string;
  explanation: string;
}

/** Lifelines granted at the start of a round. */
const LIFELINES_PER_ROUND = 2;

/**
 * The single-player round engine.
 *
 * This replaces the ~1,200 lines of `game.js` that mutated a global `state`
 * object and hand-patched the DOM after every change. Here the engine owns the
 * data and the components render from it; nothing in this file touches the DOM.
 */
class GameStore {
  // ---- round configuration ----
  mode = $state<ModeId>('all');
  /** Practice mode: no countdown, manual advance, nothing submitted. */
  practice = $state(false);
  /** Daily challenge: fixed set, no adaptive, separate board. */
  daily = $state(false);

  // ---- round progress ----
  phase = $state<GamePhase>('idle');
  index = $state(0);
  score = $state(0);
  correct = $state(0);
  streak = $state(0);
  bestStreak = $state(0);
  history = $state<RoundAnswer[]>([]);

  // ---- current question ----
  current = $state<Question | null>(null);
  answered = $state(false);
  selected = $state<string | null>(null);
  /** Option labels removed by the 50:50 lifeline. */
  eliminated = $state<string[]>([]);
  lifelines = $state(LIFELINES_PER_ROUND);
  feedback = $state<Feedback | null>(null);
  /** Set once the round is graded so the UI can style the fill input. */
  fillVerdict = $state<'correct' | 'wrong' | null>(null);

  // ---- timing ----
  timeLeft = $state(0);
  questionTime = $state(15);

  // ---- internals ----
  #pool: RawQuestion[] = [];
  /** Reactive: the derived totals below depend on its length. */
  #round = $state<(RawQuestion | null)[]>([]);
  #adaptive: AdaptivePicker | null = null;
  #timerId: ReturnType<typeof setInterval> | null = null;
  #advanceId: ReturnType<typeof setTimeout> | null = null;
  #lastTickSecond = -1;
  #questionStartedAt = 0;

  // ---- derived ----
  total = $derived(this.#round.length);
  progress = $derived(`${Math.min(this.index + 1, this.total)} / ${this.total}`);
  isLastQuestion = $derived(this.index >= this.#round.length - 1);
  accuracy = $derived(this.total ? Math.round((this.correct / this.total) * 100) : 0);
  /** 1 → 0 as the question's time runs out; drives the countdown ring. */
  timeFraction = $derived(this.questionTime > 0 ? Math.max(0, this.timeLeft / this.questionTime) : 0);
  canUseFifty = $derived(
    !this.answered &&
      this.lifelines > 0 &&
      !!this.current &&
      this.current.style !== 'fill' &&
      this.current.options.length - this.eliminated.length > 2
  );

  // ================= round lifecycle =================

  /** Load the pool for a mode (cached) so a round can start instantly later. */
  async preload(mode: ModeId): Promise<void> {
    this.#pool = await getQuestions(mode);
  }

  async startRound(mode: ModeId, opts: { practice?: boolean; daily?: boolean } = {}): Promise<void> {
    this.mode = mode;
    this.practice = !!opts.practice;
    this.daily = !!opts.daily;

    this.#pool = await getQuestions(opts.daily ? 'all' : mode);

    if (opts.daily) {
      this.#round = buildDailyRound(this.#pool);
      this.#adaptive = null;
    } else if (settings.adaptive) {
      // Adaptive rounds fill each slot on demand from the running target.
      const count = Math.min(settings.questions || 10, this.#pool.length || 10);
      this.#adaptive = new AdaptivePicker(this.#pool);
      this.#round = new Array(Math.max(1, count)).fill(null);
    } else {
      this.#adaptive = null;
      this.#round = buildRoundFromPool(this.#pool, {
        questions: settings.questions,
        difficulty: settings.difficulty
      });
    }

    this.#resetProgress();
    if (!this.#round.length) {
      this.phase = 'idle';
      return;
    }
    this.#showQuestion();
  }

  #resetProgress(): void {
    this.#clearTimers();
    this.index = 0;
    this.score = 0;
    this.correct = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.history = [];
    this.lifelines = LIFELINES_PER_ROUND;
    this.feedback = null;
    this.current = null;
  }

  #showQuestion(): void {
    this.#clearTimers();
    this.answered = false;
    this.selected = null;
    this.eliminated = [];
    this.feedback = null;
    this.fillVerdict = null;

    if (this.index >= this.#round.length) {
      this.finish();
      return;
    }

    // Adaptive rounds materialize the slot only when it is reached.
    if (this.#adaptive && !this.#round[this.index]) {
      const picked = this.#adaptive.next();
      if (!picked) {
        this.finish();
        return;
      }
      this.#round[this.index] = picked;
    }

    const raw = this.#round[this.index];
    if (!raw) {
      this.finish();
      return;
    }

    this.current = normalizeQuestion(raw, {
      languagePrompt: i18n.t('langPrompt'),
      fillPrompt: i18n.t('fillPrompt'),
      fallbackBank: this.mode === 'all' ? undefined : (this.mode as Question['bank']),
      pick: i18n.pick
    });

    this.phase = 'question';
    this.questionTime = this.#resolveQuestionTime(this.current.difficulty);
    this.#questionStartedAt = Date.now();

    if (this.practice) {
      // No countdown — take your time. timeLeft stays finite (full time) so the
      // score can never become Infinity; the display just shows ∞.
      this.timeLeft = this.questionTime;
    } else {
      this.#startTimer(this.questionTime);
    }
  }

  /** Player's "time per question" setting wins over the per-difficulty default. */
  #resolveQuestionTime(difficulty: string): number {
    const t = settings.timer;
    if (t && t !== 'auto') {
      const n = Number(t);
      if (n > 0) return n;
    }
    return timeForDifficulty(difficulty);
  }

  // ================= answering =================

  /**
   * Pick a choice option. The answer stays changeable until the timer expires;
   * once locked in, a long countdown fast-forwards to 2s so the player isn't
   * left waiting.
   */
  select(label: string): void {
    if (this.answered) return;
    this.selected = label;
    if (this.practice) {
      this.resolve(label, false);
      return;
    }
    if (this.timeLeft > 2) this.timeLeft = 2;
  }

  /** Submit a typed fill-in-the-blank answer. */
  submitFill(typed: string): void {
    if (!this.current || this.current.style !== 'fill' || this.answered) return;
    this.selected = typed;
    this.resolve(typed, false);
  }

  /** 50:50 — drop two wrong options from the current choice question. */
  useFifty(): void {
    if (!this.canUseFifty || !this.current) return;
    const wrong = this.current.options
      .map((o) => o.label)
      .filter((label) => label !== this.current!.answer && !this.eliminated.includes(label));
    if (wrong.length <= 1) return; // already down to the answer + one wrong
    this.eliminated = [...this.eliminated, ...shuffle(wrong).slice(0, 2)];
    this.lifelines -= 1;
    sfx.tick(3);
  }

  /** Grade the current question and show feedback. */
  resolve(chosen: string | null, timedOut: boolean): void {
    const cur = this.current;
    if (!cur || this.answered) return;

    this.answered = true;
    this.#clearTimer();

    const isFill = cur.style === 'fill';
    const correct = isFill ? isFillCorrect(cur, chosen ?? '') : chosen === cur.answer;
    if (isFill) this.fillVerdict = correct ? 'correct' : 'wrong';

    let gained = 0;
    const explanation = i18n.pick(cur.explanation);

    if (correct) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.correct += 1;
      gained = scoreAnswer(this.timeLeft, this.streak);
      this.score += gained;
      sfx.correct();
      const bonus = this.streak >= 3 ? `  ${i18n.t('streakBonus')}` : '';
      this.feedback = { kind: 'good', headline: `${i18n.t('correct')} +${gained}${bonus}`, explanation };
    } else {
      this.streak = 0;
      sfx.wrong();
      // A timeout with nothing picked gets the "time's up" wording instead.
      const noPick = timedOut && !(isFill ? normFill(chosen) : chosen);
      const headline = noPick ? `${i18n.t('timeUp')} ${cur.answer}.` : `${i18n.t('wrong')} ${cur.answer}.`;
      this.feedback = { kind: 'bad', headline, explanation };
    }

    this.history = [
      ...this.history,
      {
        question: cur,
        chosen: chosen ?? null,
        correct,
        points: gained,
        timedOut
      }
    ];

    this.#adaptive?.bump(correct);
    this.phase = 'feedback';
    this.index += 1;
    this.#scheduleAdvance();
  }

  /** Move to the next question (or the results screen). */
  next(): void {
    this.#clearAdvance();
    this.#showQuestion();
  }

  #scheduleAdvance(): void {
    this.#clearAdvance();
    // Practice always waits for a manual "Next" so the explanation can be read.
    if (this.practice) return;
    const seconds = settings.feedbackDelay;
    if (!seconds) return; // 0 = manual
    this.#advanceId = setTimeout(() => this.next(), seconds * 1000);
  }

  finish(): void {
    this.#clearTimers();
    this.phase = 'finished';
    this.current = null;
    sfx.finish();
    if (!this.practice) {
      const key = this.daily ? 'daily' : this.mode;
      if (this.score > highScore(key)) setHighScore(key, this.score);
    }
  }

  /** Abandon the round and return to the menu. */
  abort(): void {
    this.#clearTimers();
    this.phase = 'idle';
    this.current = null;
  }

  // ================= timer =================

  #startTimer(seconds: number): void {
    this.timeLeft = seconds;
    this.#lastTickSecond = -1;
    this.#timerId = setInterval(() => {
      this.timeLeft -= 1;
      // Beep over the final 3 seconds, but only while unanswered.
      if (this.timeLeft <= 3 && this.timeLeft > 0 && !this.answered && this.timeLeft !== this.#lastTickSecond) {
        this.#lastTickSecond = this.timeLeft;
        sfx.tick(this.timeLeft);
      }
      if (this.timeLeft <= 0) {
        this.#clearTimer();
        this.resolve(this.selected, true);
      }
    }, 1000);
  }

  #clearTimer(): void {
    if (this.#timerId !== null) {
      clearInterval(this.#timerId);
      this.#timerId = null;
    }
  }

  #clearAdvance(): void {
    if (this.#advanceId !== null) {
      clearTimeout(this.#advanceId);
      this.#advanceId = null;
    }
  }

  #clearTimers(): void {
    this.#clearTimer();
    this.#clearAdvance();
  }

  /** Milliseconds spent on the current question — used by the round summary. */
  get elapsedOnQuestion(): number {
    return Math.max(0, Date.now() - (this.#questionStartedAt || Date.now()));
  }
}

export const game = new GameStore();
