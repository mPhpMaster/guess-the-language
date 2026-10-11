import { $, announce } from './dom.js';
import { beginRound } from './game.js';
import { t } from './i18n.js';
import { shuffle } from './round.js';
import { ensureValidPlayerName, requireNameToInteract } from './settings.js';
import { state } from './state.js';

// ============================================================
//  Mistake review — spaced repetition.
//
//  Every question a player misses (in any solo round: normal, styled, daily,
//  practice) goes into a review queue due tomorrow. In a review round each
//  correct answer pushes it further out — 1, 3, 7 then 14 days — and a correct
//  answer at the last step retires it. A miss sends it back to the start.
//
//  Kept per device in localStorage: the queue holds only `bank|id` keys and two
//  numbers each, needs no account, and costs no server round-trip per answer.
// ============================================================
const KEY = 'gtl_review';
export const REVIEW_INTERVALS = [1, 3, 7, 14]; // days, by box
export const REVIEW_ROUND_MAX = 20;
const MAX_ENTRIES = 400; // oldest-due entries are dropped beyond this

export function today() { return Math.floor(Date.now() / 86400000); }

export function loadReview() {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '{}');
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (_) { return {}; }
}

function saveReview(map) {
    try {
        const keys = Object.keys(map);
        if (keys.length > MAX_ENTRIES) {
            keys.sort((a, b) => (map[b].due || 0) - (map[a].due || 0));
            keys.slice(MAX_ENTRIES).forEach((k) => delete map[k]);
        }
        localStorage.setItem(KEY, JSON.stringify(map));
    } catch (_) { /* storage full or blocked — review is best-effort */ }
}

export function reviewKey(q) {
    return q && q.id != null ? `${q.bank || 'languages'}|${q.id}` : '';
}

// Called for every resolved solo answer.
export function noteReviewAnswer(cur, correct) {
    const k = reviewKey(cur);
    if (!k) return;
    const map = loadReview();
    const e = map[k];
    const now = today();
    if (!correct) {
        map[k] = { box: 0, due: now + REVIEW_INTERVALS[0], misses: ((e && e.misses) || 0) + 1 };
    } else if (e && (state.review || e.due <= now)) {
        // Only a review round — or meeting the question again once it's due —
        // counts as recall. Seeing it the same day it was missed proves little.
        const box = (e.box || 0) + 1;
        if (box >= REVIEW_INTERVALS.length) delete map[k];
        else map[k] = { ...e, box, due: now + REVIEW_INTERVALS[box] };
    } else {
        return;
    }
    saveReview(map);
}

export function reviewCounts() {
    const map = loadReview();
    const now = today();
    let due = 0, total = 0, next = Infinity;
    for (const e of Object.values(map)) {
        total += 1;
        if ((e.due || 0) <= now) due += 1;
        else next = Math.min(next, e.due);
    }
    return { due, total, nextInDays: Number.isFinite(next) ? next - now : null };
}

export function renderReviewButton() {
    const btn = $('#btn-review');
    if (!btn) return;
    const { due, total, nextInDays } = reviewCounts();
    btn.classList.toggle('hidden', total === 0);
    btn.disabled = due === 0;
    btn.textContent = '';
    const label = document.createElement('span');
    label.textContent = t('reviewMistakes');
    const badge = document.createElement('span');
    badge.className = 'review-badge' + (due ? ' is-due' : '');
    badge.textContent = due ? String(due) : (nextInDays != null ? t('reviewNextIn').replace('{n}', String(nextInDays)) : '');
    btn.append(label, badge);
    btn.title = due ? t('reviewDueTitle').replace('{n}', String(due)) : t('reviewNoneDue');
}

export async function startReview() {
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    let all = [];
    try { all = await window.gameAPI.getQuestions('all'); } catch (_) { /* handled below */ }
    const map = loadReview();
    const now = today();
    const byKey = new Map(all.map((q) => [reviewKey(q), q]));
    const dueKeys = Object.keys(map).filter((k) => (map[k].due || 0) <= now);
    // A question removed from its bank since it was missed can't be asked again.
    dueKeys.filter((k) => !byKey.has(k)).forEach((k) => delete map[k]);
    saveReview(map);
    const round = shuffle(dueKeys.filter((k) => byKey.has(k)).map((k) => byKey.get(k))).slice(0, REVIEW_ROUND_MAX);
    if (!round.length) { announce(t('reviewNoneDue')); renderReviewButton(); return; }
    state.round = round;
    state.style = 'classic';
    state.daily = false;
    state.learn = true; // untimed, explanation-first, never on a board
    state.review = true;
    state.duel = null;
    state.focused = false;
    state.adaptive = false;
    state.reviewStartDue = round.length;
    beginRound();
}

// Results line for a finished review round.
export function reviewSummary() {
    const cleared = (state.roundHistory || []).filter((h) => h.correct).length;
    const missed = (state.roundHistory || []).length - cleared;
    return t('reviewSummary').replace('{ok}', String(cleared)).replace('{bad}', String(missed));
}
