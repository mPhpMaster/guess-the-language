import { readString, writeString } from './storage';
import type { BankedQuestion } from '../types/models';

/* ============================================================
   Daily Challenge — the same 10 questions for everyone, every
   day, flipping at 00:00 UTC worldwide.
   ============================================================ */

export const DAILY_QUESTION_COUNT = 10;

/** Small deterministic PRNG so every client picks the identical daily set. */
function mulberry32(seed: number): () => number {
    let state = seed;
    return (): number => {
        state |= 0;
        state = (state + 0x6d2b_79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function dailySeed(): number {
    const now = new Date();
    return now.getUTCFullYear() * 10_000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

export function dailyDateKey(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}-${day}`;
}

function randomShuffle<T>(items: readonly T[], rand: () => number): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const a = copy[i] as T;
        const b = copy[j] as T;
        copy[i] = b;
        copy[j] = a;
    }
    return copy;
}

/**
 * Deterministic 10 questions from the whole pool. Sorted by a stable (bank, id)
 * key first so the selection is identical on every client that day regardless of
 * load order.
 */
export function buildDailyRound(pool: readonly BankedQuestion[]): readonly BankedQuestion[] {
    const stable = pool
        .slice()
        .sort((a, b) => a.bank.localeCompare(b.bank) || a.id - b.id);
    return randomShuffle(stable, mulberry32(dailySeed())).slice(0, DAILY_QUESTION_COUNT);
}

/** Local "already played today" marker (the server unique(day,player) is the real guard). */
function dailyDoneKey(): string {
    return `gtl_daily_done_${dailyDateKey()}`;
}

export function isDailyDone(): boolean {
    return readString(dailyDoneKey()) === '1';
}

export function markDailyDone(): void {
    writeString(dailyDoneKey(), '1');
}
