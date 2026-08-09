import type { DifficultyFilter } from '$lib/game/types';
import { sanitizeName } from '$lib/game/names';

export type TimerSetting = 'auto' | '10' | '15' | '20' | '30';
export type FeedbackDelay = 2 | 4 | 6 | 0;

export interface Settings {
  questions: number;
  sound: boolean;
  difficulty: DifficultyFilter;
  timer: TimerSetting;
  /** Seconds the answer review stays up; 0 means "advance manually". */
  feedbackDelay: FeedbackDelay;
  name: string;
  /** Adjust question difficulty to the player's performance. */
  adaptive: boolean;
  /** Publish mode / round / score to this player's Discord profile card. */
  discordPresence: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  questions: 10,
  sound: true,
  difficulty: 'all',
  timer: 'auto',
  feedbackDelay: 4,
  name: '',
  adaptive: false,
  discordPresence: true
};

const STORAGE_KEY = 'gtl_settings';

function readStored(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Settings>) : {};
  } catch {
    return {};
  }
}

/**
 * Player settings, persisted to localStorage on every change.
 *
 * The original read `getSettings()` — a fresh object off localStorage — at every
 * call site. Here it is one reactive object: components read fields directly and
 * re-render when they change, and persistence is a single effect.
 */
class SettingsStore {
  #value = $state<Settings>({ ...DEFAULT_SETTINGS });

  constructor() {
    this.#value = { ...DEFAULT_SETTINGS, ...readStored() };
  }

  get current(): Settings {
    return this.#value;
  }

  get questions(): number { return this.#value.questions; }
  get sound(): boolean { return this.#value.sound; }
  get difficulty(): DifficultyFilter { return this.#value.difficulty; }
  get timer(): TimerSetting { return this.#value.timer; }
  get feedbackDelay(): FeedbackDelay { return this.#value.feedbackDelay; }
  get adaptive(): boolean { return this.#value.adaptive; }
  get discordPresence(): boolean { return this.#value.discordPresence; }
  get name(): string { return this.#value.name; }

  update(patch: Partial<Settings>): void {
    this.#value = { ...this.#value, ...patch };
    this.#persist();
  }

  setName(raw: string): void {
    this.update({ name: sanitizeName(raw) });
  }

  #persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#value));
    } catch {
      /* storage full or blocked — settings just won't survive a reload */
    }
  }
}

export const settings = new SettingsStore();

// ---------- High scores ----------

export function highScore(mode: string): number {
  try {
    const v = Number(localStorage.getItem(`gtl_highscore_${mode}`) ?? 0);
    // Heal any non-finite value written by the old practice ∞-timer bug.
    if (!Number.isFinite(v)) {
      localStorage.removeItem(`gtl_highscore_${mode}`);
      return 0;
    }
    return v;
  } catch {
    return 0;
  }
}

// ---------- Daily challenge marker ----------

/**
 * Local "already played today" flag. The server's unique (day, player)
 * constraint is the real guard — this only drives the button label.
 */
export function isDailyDone(dateKey: string): boolean {
  try {
    return localStorage.getItem(`gtl_daily_done_${dateKey}`) === '1';
  } catch {
    return false;
  }
}

export function markDailyDone(dateKey: string): void {
  try {
    localStorage.setItem(`gtl_daily_done_${dateKey}`, '1');
  } catch {
    /* ignore */
  }
}

export function setHighScore(mode: string, value: number): void {
  if (!Number.isFinite(value)) return; // never store Infinity/NaN
  try {
    localStorage.setItem(`gtl_highscore_${mode}`, String(value));
  } catch {
    /* ignore */
  }
}
