import { $ } from './dom.js';
import { t } from './i18n.js';
import { buildRoundFromPool, sampleAcrossBanks, shuffle } from './round.js';
import { state } from './state.js';

// ============================================================
//  Play styles: how a round is played, on top of WHAT is asked (the mode).
//
//  classic  — the normal round: N questions, a timer per question.
//  survival — three lives; the round runs until the third miss and gets harder
//             the longer you last (capped at SURVIVAL_MAX_QUESTIONS).
//  speedrun — one 60-second clock for the whole round; answer as many as you can.
//  hardcore — no options for "which language" questions (type the name), no
//             50:50, and a shorter clock on everything else.
//
//  Each non-classic style has ONE global board ('survival' / 'speedrun' /
//  'hardcore') whatever topic was picked; /api/submit-score knows the same keys.
// ============================================================
export const STYLES = ['classic', 'survival', 'speedrun', 'hardcore'];
export const SURVIVAL_LIVES = 3;
// Keep in step with SURVIVAL_MAX_QUESTIONS in api/submit-score.js (score bound).
export const SURVIVAL_MAX_QUESTIONS = 50;
export const SPEEDRUN_SECONDS = 60;
const STYLE_KEY = 'gtl_style';

// The style picked on Home (persisted). A round copies it into state.style when it
// starts, so changing the picker mid-round can't change the round being played.
export function pickedStyle() {
    try {
        const s = localStorage.getItem(STYLE_KEY);
        return STYLES.includes(s) ? s : 'classic';
    } catch (_) { return 'classic'; }
}
export function setPickedStyle(style) {
    const s = STYLES.includes(style) ? style : 'classic';
    try { localStorage.setItem(STYLE_KEY, s); } catch (_) {}
    renderStyleSwitch();
}
export function isStyled() { return !!state.style && state.style !== 'classic'; }
export function isStyle(s) { return state.style === s; }

// The board a finished round belongs on: a style board for a styled round, else
// the topic's own board.
export function roundBoardMode() {
    return isStyled() ? state.style : state.mode;
}

export function styleLabel(style) {
    return t({ classic: 'styleClassic', survival: 'styleSurvival', speedrun: 'styleSpeedrun', hardcore: 'styleHardcore' }[style] || 'styleClassic');
}

export function renderStyleSwitch() {
    const wrap = $('#style-switch');
    if (!wrap) return;
    const cur = pickedStyle();
    wrap.querySelectorAll('[data-style]').forEach((b) => {
        const on = b.dataset.style === cur;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    const hint = $('#style-hint');
    if (hint) hint.textContent = t('styleHint_' + cur);
}

// ---------- Round building ----------
// Difficulty a survival question should be at a given depth: a warm-up, then the
// middle, then only the hard ones.
export function survivalTarget(index) {
    return index < 8 ? 'easy' : index < 20 ? 'medium' : 'hard';
}

export function buildSurvivalRound(pool) {
    const byDiff = { easy: [], medium: [], hard: [] };
    (pool || []).forEach((q) => (byDiff[q.difficulty] || byDiff.medium).push(q));
    // Each difficulty is dealt mode-balanced, so an "All" survival run still mixes topics.
    const queues = {};
    for (const d of Object.keys(byDiff)) queues[d] = sampleAcrossBanks(byDiff[d], byDiff[d].length, shuffle);
    const order = { easy: ['easy', 'medium', 'hard'], medium: ['medium', 'hard', 'easy'], hard: ['hard', 'medium', 'easy'] };
    const out = [];
    const total = Math.min(SURVIVAL_MAX_QUESTIONS, (pool || []).length);
    for (let i = 0; i < total; i++) {
        const want = order[survivalTarget(i)];
        const from = want.find((d) => queues[d].length);
        if (!from) break;
        out.push(queues[from].shift());
    }
    return out;
}

export function buildSpeedrunRound(pool, settings) {
    let filtered = pool || [];
    if (settings.difficulty !== 'all') {
        const f = filtered.filter((q) => q.difficulty === settings.difficulty);
        if (f.length) filtered = f;
    }
    // More than anyone can answer in a minute; the clock ends the round, not the list.
    return sampleAcrossBanks(filtered, Math.min(150, filtered.length), shuffle);
}

export function buildStyledRound(style, pool, settings) {
    if (style === 'survival') return buildSurvivalRound(pool);
    if (style === 'speedrun') return buildSpeedrunRound(pool, settings);
    return buildRoundFromPool(pool, settings);
}

// ---------- Hardcore ----------
// Accepted spellings when a language name has to be typed.
export const LANGUAGE_ALIASES = {
    'Python': ['py', 'python3'],
    'JavaScript': ['js', 'node', 'nodejs', 'node.js', 'ecmascript'],
    'TypeScript': ['ts'],
    'C++': ['cpp', 'cplusplus', 'c plus plus'],
    'C': ['ansi c', 'c lang'],
    'C#': ['csharp', 'c sharp', 'cs'],
    'Java': [],
    'Kotlin': ['kt'],
    'Swift': [],
    'Rust': ['rs'],
    'Go': ['golang'],
    'Ruby': ['rb'],
    'PHP': [],
    'SQL': ['sqlite', 'postgresql', 'postgres', 'mysql', 'tsql', 't-sql', 'plpgsql'],
    'Bash': ['sh', 'shell', 'zsh', 'bash script', 'shell script']
};

// A hardcore MC question gets 60% of the usual time, never under 5s. Typed
// language answers keep the full time: typing is the hard part already.
export function hardcoreTime(seconds, typed) {
    if (typed) return seconds;
    return Math.max(5, Math.round(seconds * 0.6));
}

// ---------- HUD ----------
export function renderLivesPill() {
    const pill = $('#lives-pill');
    if (!pill) return;
    const show = isStyle('survival') && !state.multiplayer;
    pill.classList.toggle('hidden', !show);
    if (!show) return;
    const left = Math.max(0, state.lives || 0);
    $('#lives-count').textContent = '♥'.repeat(left) + '♡'.repeat(Math.max(0, SURVIVAL_LIVES - left));
    pill.setAttribute('aria-label', t('livesLeft').replace('{n}', String(left)));
}

// Speed run: one clock for the whole round, drawn on the same run-bar.
export function speedrunRemaining() {
    if (!state.speedEndsAt) return 0;
    return Math.max(0, (state.speedEndsAt - Date.now()) / 1000);
}
