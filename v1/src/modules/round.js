import { LANGUAGES } from './constants.js';
import { announce } from './dom.js';
import { beginRound } from './game.js';
import { t } from './i18n.js';
import { getSettings } from './identity.js';
import { ensureValidPlayerName, requireNameToInteract } from './settings.js';
import { state } from './state.js';

// ============================================================
//  Round building
// ============================================================
export function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function shuffleOptions(arr, optionSeed) {
    if (optionSeed != null && window.GTL_MULTIPLAYER) {
        return window.GTL_MULTIPLAYER.seededShuffle(arr, optionSeed);
    }
    return shuffle(arr);
}

// Number of language choices shown per question. The pool (LANGUAGES) is larger,
// so each question shows the correct language plus a rotating set of distractors.
export const LANG_OPTION_COUNT = 4;

// Pick the on-screen language options for a question: the correct language plus
// (LANG_OPTION_COUNT-1) distractors from the pool, then shuffle. optionSeed keeps
// the selection identical for every player in a multiplayer round.
export function buildLanguageOptions(correctName, optionSeed) {
    const correct =
        LANGUAGES.find((l) => l.name === correctName) ||
        { name: correctName, glyph: '?', color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)' };
    const others = LANGUAGES.filter((l) => l.name !== correct.name);
    const distractors = shuffleOptions(others, optionSeed).slice(0, LANG_OPTION_COUNT - 1);
    const seed2 = optionSeed != null ? ((optionSeed ^ 0x9e3779b9) >>> 0) : null;
    return shuffleOptions([correct, ...distractors], seed2).map((l) => ({
        label: l.name,
        glyph: l.glyph,
        color: l.color
    }));
}

export function scoreAnswer(timeLeft, streakAfter) {
    const multiplier = streakAfter >= 3 ? 1.5 : 1;
    // Guard against a non-finite timeLeft (e.g. practice mode's ∞ timer) so the
    // score can never become Infinity.
    const t = Number.isFinite(timeLeft) ? Math.max(0, timeLeft) : 0;
    return Math.round((100 + 10 * t) * multiplier);
}

export function timeForDifficulty(d) {
    return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

// Seconds for a single-player question: the headless-test seam wins, then the
// player's "Time per question" setting (a fixed value or "auto"), else the
// per-difficulty default.
export function resolvedQuestionTime(difficulty) {
    if (typeof window.__GTL_QTIME === 'number' && window.__GTL_QTIME > 0) return window.__GTL_QTIME;
    const t = getSettings().timer;
    if (t && t !== 'auto') {
        const n = Number(t);
        if (n > 0) return n;
    }
    return timeForDifficulty(difficulty);
}

// Deal `count` questions round-robin across the banks present in the pool, so a
// mixed round can't be swallowed by the biggest bank. Drawing uniformly used to
// mean ~45% of 10-question "All" rounds contained no Problem Solving question at
// all, because `languages` alone is over half the pool. One pass gives every bank
// a slot before any bank repeats; the bank order and the final order are shuffled
// so the rotation isn't visible to the player.
export function sampleAcrossBanks(pool, count, shuffleFn) {
    const byBank = new Map();
    pool.forEach((q) => {
        const bank = q.bank || 'languages';
        if (!byBank.has(bank)) byBank.set(bank, []);
        byBank.get(bank).push(q);
    });
    // Single-bank pool (any specific mode): nothing to balance.
    if (byBank.size < 2) return shuffleFn(pool).slice(0, count);

    const queues = shuffleFn(Array.from(byBank.values())).map((qs) => shuffleFn(qs));
    const picked = [];
    for (let depth = 0; picked.length < count; depth++) {
        let dealt = false;
        for (const queue of queues) {
            if (depth >= queue.length) continue;
            picked.push(queue[depth]);
            dealt = true;
            if (picked.length === count) break;
        }
        if (!dealt) break; // every bank exhausted
    }
    return shuffleFn(picked);
}

export function buildRoundFromPool(pool, settings) {
    let filtered = pool;
    if (settings.difficulty !== 'all') filtered = pool.filter((q) => q.difficulty === settings.difficulty);
    if (filtered.length === 0) filtered = pool;
    return sampleAcrossBanks(filtered, Math.min(settings.questions, filtered.length), shuffle);
}

export function buildRound() {
    state.round = buildRoundFromPool(state.allQuestions, getSettings());
}

// ---------- Adaptive difficulty (opt-in) ----------
// When on, questions are picked one at a time: the target difficulty rises after a
// correct answer and falls after a wrong one, so the round meets the player's level.
export function setupAdaptive(pool, count) {
    state.adaptive = true;
    state.adaptiveTarget = 'easy';
    state.adaptiveUsed = new Set();
    state.adaptivePool = { easy: [], medium: [], hard: [] };
    (pool || []).forEach((q) => {
        const d = state.adaptivePool[q.difficulty] ? q.difficulty : 'medium';
        state.adaptivePool[d].push(q);
    });
    state.round = new Array(Math.max(1, count)).fill(null);
}
export function pickAdaptiveQuestion() {
    const prefer = ({
        easy: ['easy', 'medium', 'hard'], medium: ['medium', 'hard', 'easy'], hard: ['hard', 'medium', 'easy']
    })[state.adaptiveTarget] || ['medium', 'easy', 'hard'];
    const key = (q) => (q.bank || '') + '|' + q.id;
    for (const d of prefer) {
        const avail = (state.adaptivePool[d] || []).filter((q) => !state.adaptiveUsed.has(key(q)));
        if (avail.length) { const q = avail[Math.floor(Math.random() * avail.length)]; state.adaptiveUsed.add(key(q)); return q; }
    }
    const all = Object.values(state.adaptivePool).flat();
    const q = all.find((x) => !state.adaptiveUsed.has(key(x))) || all[0];
    if (q) state.adaptiveUsed.add(key(q));
    return q;
}
export function bumpAdaptive(correct) {
    if (!state.adaptive) return;
    const up = { easy: 'medium', medium: 'hard', hard: 'hard' };
    const down = { hard: 'medium', medium: 'easy', easy: 'easy' };
    state.adaptiveTarget = correct ? up[state.adaptiveTarget] : down[state.adaptiveTarget];
}
// Turn adaptive on for a single-player round if the setting is enabled.
export function maybeSetupAdaptive() {
    if (getSettings().adaptive && !state.daily) {
        setupAdaptive(state.allQuestions, Math.min(getSettings().questions || 10, (state.allQuestions || []).length || 10));
    } else {
        state.adaptive = false;
    }
}

// ---------- Daily Challenge: the same 10 questions for everyone, every day ----------
export const DAILY_QUESTION_COUNT = 10;
// Small deterministic PRNG so every client picks the identical daily set.
export function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Integer seed derived from the UTC date, so the day flips at 00:00 UTC worldwide.
export function dailySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
export function dailyDateKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function seededShuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// Deterministic 10 questions from the whole pool. Sorted by a stable (bank,id) key
// first so the selection is identical on every client that day regardless of load order.
export function buildDailyRound(pool) {
    const stable = (pool || []).slice().sort((a, b) =>
        String(a.bank).localeCompare(String(b.bank)) || (Number(a.id) - Number(b.id)));
    return seededShuffle(stable, mulberry32(dailySeed())).slice(0, DAILY_QUESTION_COUNT);
}

// Local "already played today" marker (the server unique(day,player) is the real guard).
export function dailyDoneKey() { return 'gtl_daily_done_' + dailyDateKey(); }
export function isDailyDone() { try { return localStorage.getItem(dailyDoneKey()) === '1'; } catch (e) { return false; } }
export function markDailyDone() { try { localStorage.setItem(dailyDoneKey(), '1'); } catch (e) {} }

export async function startDailyChallenge() {
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    if (!state.allQuestions || !state.allQuestions.length) {
        try { state.allQuestions = await window.gameAPI.getQuestions('all'); } catch (e) { /* ignore */ }
    }
    const round = buildDailyRound(state.allQuestions);
    if (!round.length) { announce(t('lbOffline')); return; }
    state.round = round;
    state.daily = true;
    state.learn = false;
    state.adaptive = false; // the daily set is fixed and identical for everyone
    state.mode = 'all'; // mixed styles; the daily board is separate from mode boards
    beginRound();
}
