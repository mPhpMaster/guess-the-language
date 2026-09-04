import { $, screens, setTitlebar } from './dom.js';
import { refreshMenu } from './events.js';
import { t } from './i18n.js';
import { refreshMultiplayerButtons } from './mp-ui.js';
import { isDailyDone, modeOfBank } from './round.js';
import { fetchPersonalRank, supabaseConfigured } from './api.js';
import { state, store } from './state.js';

// ---------- Home eyebrow + per-mode question counts ----------
// The mode list shows how many questions each mode holds. One 'all' load returns
// every bank already tagged, so all seven counts come from a single call — and
// it is cached and fired after boot, so it never blocks the first paint. Banks
// are summed by MODE, not by bank: Problem Solving spans three of them.
let countsPromise = null;

export function loadModeCounts() {
    if (countsPromise) return countsPromise;
    countsPromise = (async () => {
        const all = await window.gameAPI.getQuestions('all');
        const byMode = { all: all.length };
        all.forEach((q) => {
            const m = modeOfBank(q.bank || 'languages');
            byMode[m] = (byMode[m] || 0) + 1;
        });
        return byMode;
    })().catch(() => null);
    return countsPromise;
}

export async function renderModeCounts() {
    const counts = await loadModeCounts();
    if (!counts) return;
    document.querySelectorAll('[data-mode-count]').forEach((el) => {
        const n = counts[el.dataset.modeCount];
        // The unit is a separate node so the phone can drop it (the design's
        // mobile home shows the bare count) without a second render path.
        if (!n) return;
        el.textContent = '';
        const num = document.createElement('span');
        num.className = 'mode-count-num';
        num.textContent = String(n);
        const unit = document.createElement('span');
        unit.className = 'mode-count-unit';
        unit.textContent = ' q';
        el.append(num, unit);
    });
    const eyebrow = $('#home-eyebrow');
    if (!eyebrow) return;
    let version = '';
    try { version = (await window.appWindow?.getVersion?.()) || ''; } catch (_) { /* ignore */ }
    eyebrow.textContent = `${version ? `v${version} · ` : ''}${counts.all} questions`;
}

// Highlight the active mode card and show its best score on the home page.
export function renderHome() {
    document.querySelectorAll('#mode-grid .mode-card').forEach((c) => {
        const selected = c.dataset.mode === state.mode;
        c.classList.toggle('selected', selected);
        c.setAttribute('aria-pressed', String(selected));
    });
    refreshMenu();
    refreshMultiplayerButtons();
    updateDailyButton();
    setTitlebar(t('appSlug'));
    renderRailStats();
}

// ---------- Rail stats: best / rank / accuracy ----------
// Accuracy is tracked locally because nothing records it server-side: `scores`
// stores a score and a mode, `player_stats` games and wins — neither carries
// correct-vs-total. A rolling per-device tally is honest and needs no migration.
const ACC_KEY = 'gtl_accuracy';

export function recordAccuracy(correct, total) {
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return;
    try {
        const prev = JSON.parse(localStorage.getItem(ACC_KEY) || '{"c":0,"t":0}');
        localStorage.setItem(ACC_KEY, JSON.stringify({
            c: (Number(prev.c) || 0) + correct,
            t: (Number(prev.t) || 0) + total
        }));
    } catch (_) { /* storage unavailable — accuracy just stays blank */ }
}

export function readAccuracy() {
    try {
        const a = JSON.parse(localStorage.getItem(ACC_KEY) || 'null');
        if (!a || !a.t) return null;
        return Math.round((a.c / a.t) * 100);
    } catch (_) { return null; }
}

// Rank is a real global position: the count of scores above this player's best
// in the current mode, +1 — the same method the results screen uses.
export async function renderRailStats() {
    const accEl = $('#rail-accuracy');
    if (accEl) {
        const acc = readAccuracy();
        accEl.textContent = acc == null ? '—' : `${acc}%`;
    }
    const rankEl = $('#rail-rank');
    if (!rankEl) return;
    const best = store.highScore(state.mode);
    if (!best || !supabaseConfigured()) { rankEl.textContent = '—'; return; }
    try {
        const rank = await fetchPersonalRank(best);
        rankEl.textContent = rank ? `#${rank}` : '—';
    } catch (_) { rankEl.textContent = '—'; }
}

// Reflect whether today's daily challenge has already been played.
export function updateDailyButton() {
    const btn = $('#btn-daily');
    if (!btn) return;
    const done = isDailyDone();
    btn.classList.toggle('is-done', done);
    // Label plus, when today is still unplayed, the design's "new" tag at the
    // row's end. Built as elements rather than one textContent assignment,
    // which would wipe the tag on every repaint.
    btn.textContent = '';
    const label = document.createElement('span');
    label.textContent = done ? t('dailyPlayed') : t('dailyChallenge');
    btn.appendChild(label);
    if (!done) {
        const tag = document.createElement('span');
        tag.className = 'daily-new';
        tag.textContent = t('dailyNew');
        btn.appendChild(tag);
    }
}

// ---------- First-run onboarding ----------
export function maybeShowOnboarding() {
    try { if (localStorage.getItem('gtl_onboarded') === '1') return; } catch (_) { return; }
    if (!screens.home.classList.contains('active')) return; // don't cover a lobby / Discord auto-join
    showOnboarding();
}
export function showOnboarding() {
    let el = document.getElementById('onboarding');
    if (!el) {
        el = document.createElement('div');
        el.id = 'onboarding';
        el.className = 'onboarding-overlay';
        el.innerHTML = '<div class="onboarding-card" role="dialog" aria-modal="true">' +
            '<div class="onboarding-emoji" aria-hidden="true">🎮</div>' +
            '<h3 class="onboarding-title"></h3><ul class="onboarding-tips"></ul>' +
            '<button type="button" class="btn btn-primary onboarding-ok"></button></div>';
        document.body.appendChild(el);
        el.querySelector('.onboarding-ok').addEventListener('click', dismissOnboarding);
        el.addEventListener('click', (e) => { if (e.target === el) dismissOnboarding(); });
    }
    el.querySelector('.onboarding-title').textContent = t('onboardTitle');
    const ul = el.querySelector('.onboarding-tips');
    ul.innerHTML = '';
    ['onboardTip1', 'onboardTip2', 'onboardTip3', 'onboardTip4'].forEach((k) => {
        const li = document.createElement('li');
        li.textContent = t(k);
        ul.appendChild(li);
    });
    el.querySelector('.onboarding-ok').textContent = t('onboardGotIt');
    el.classList.add('show');
}
export function dismissOnboarding() {
    try { localStorage.setItem('gtl_onboarded', '1'); } catch (_) {}
    document.getElementById('onboarding')?.classList.remove('show');
}
