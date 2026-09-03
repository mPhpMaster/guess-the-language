import { $, screens } from './dom.js';
import { refreshMenu } from './events.js';
import { t } from './i18n.js';
import { refreshMultiplayerButtons } from './mp-ui.js';
import { isDailyDone, modeOfBank } from './round.js';
import { state } from './state.js';

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
        if (n) el.textContent = `${n} q`;
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
}

// Reflect whether today's daily challenge has already been played.
export function updateDailyButton() {
    const btn = $('#btn-daily');
    if (!btn) return;
    const done = isDailyDone();
    btn.classList.toggle('is-done', done);
    btn.textContent = done ? `🗓️  ${t('dailyPlayed')}` : `🗓️  ${t('dailyChallenge')}`;
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
