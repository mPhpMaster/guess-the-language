import type { Difficulty, RawQuestion } from './types';

/**
 * Adaptive difficulty (opt-in). Questions are drawn one at a time: the target
 * difficulty rises after a correct answer and falls after a wrong one, so the
 * round meets the player where they are.
 *
 * The original kept four loose fields on the global `state` object; folding them
 * into one class keeps the buckets and the "already used" set impossible to
 * desynchronize.
 */
export class AdaptivePicker {
  #target: Difficulty = 'easy';
  #used = new Set<string>();
  #buckets: Record<Difficulty, RawQuestion[]> = { easy: [], medium: [], hard: [] };

  constructor(pool: readonly RawQuestion[]) {
    for (const q of pool) {
      const d: Difficulty = this.#buckets[q.difficulty] ? q.difficulty : 'medium';
      this.#buckets[d].push(q);
    }
  }

  get target(): Difficulty {
    return this.#target;
  }

  static #key(q: RawQuestion): string {
    return `${q.bank ?? ''}|${q.id}`;
  }

  /** Preference order per target, so an empty bucket degrades sensibly. */
  static #preference(target: Difficulty): readonly Difficulty[] {
    switch (target) {
      case 'easy':
        return ['easy', 'medium', 'hard'];
      case 'hard':
        return ['hard', 'medium', 'easy'];
      default:
        return ['medium', 'hard', 'easy'];
    }
  }

  next(): RawQuestion | null {
    for (const d of AdaptivePicker.#preference(this.#target)) {
      const avail = this.#buckets[d].filter((q) => !this.#used.has(AdaptivePicker.#key(q)));
      if (avail.length) {
        const q = avail[Math.floor(Math.random() * avail.length)]!;
        this.#used.add(AdaptivePicker.#key(q));
        return q;
      }
    }
    // Every bucket exhausted at the target — fall back to any unused question.
    const all = Object.values(this.#buckets).flat();
    const q = all.find((x) => !this.#used.has(AdaptivePicker.#key(x))) ?? all[0];
    if (q) this.#used.add(AdaptivePicker.#key(q));
    return q ?? null;
  }

  /** Step the target after grading an answer. */
  bump(correct: boolean): void {
    const up: Record<Difficulty, Difficulty> = { easy: 'medium', medium: 'hard', hard: 'hard' };
    const down: Record<Difficulty, Difficulty> = { hard: 'medium', medium: 'easy', easy: 'easy' };
    this.#target = correct ? up[this.#target] : down[this.#target];
  }
}
