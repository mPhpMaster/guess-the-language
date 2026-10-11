import { recordPlay, sbFetch, supabaseConfigured } from './api.js';
import { $, announce, closeDialog, openDialog } from './dom.js';
import { formatScore } from './format.js';
import { beginRound } from './game.js';
import { t } from './i18n.js';
import { appApiPrefix, discordAvatarUrl, getAppSessionToken, getDiscordProfile, isDiscordActivity, safeDisplayName } from './identity.js';
import { lobbyStartGame, loadAllBanks, mpOnline, returnHome } from './mp-ui.js';
import { sampleAcrossBanks, scoreAnswer, shuffle } from './round.js';
import { ensureValidPlayerName, getPlayerName, requireNameToInteract } from './settings.js';
import { state } from './state.js';

// ============================================================
//  Ranked duel — one-on-one, 10 questions, Elo-rated.
//
//  Search: ask /api/duel for a waiting opponent. If one is waiting, join their
//  room by code. If not, host a ranked room, post its code as an offer and wait
//  SEARCH_SECONDS for someone to take it. If nobody does — or the duel service
//  is unreachable — play a bot rated near you instead, as the duel is meant to
//  be instant. A human duel is an ordinary multiplayer room (settings.ranked),
//  so it reuses the server-graded multiplayer engine; a bot duel is a solo
//  round with a simulated opponent answering alongside.
// ============================================================
export const DUEL_QUESTIONS = 10;
export const SEARCH_SECONDS = 20;
const LATE_JOIN_GRACE_MS = 8000;
const RATING_CACHE = 'gtl_duel_rating';

let search = null;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function duelApi(body) {
    const token = getAppSessionToken();
    if (!token) return { ok: false, status: 0, data: null };
    try {
        const res = await fetch(`${appApiPrefix()}/api/duel`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch (_) {
        return { ok: false, status: 0, data: null };
    }
}

function cachedRating() {
    try { const v = Number(localStorage.getItem(RATING_CACHE)); return Number.isFinite(v) && v > 0 ? v : 1000; } catch (_) { return 1000; }
}
function cacheRating(r) {
    try { if (Number.isFinite(r)) localStorage.setItem(RATING_CACHE, String(r)); } catch (_) {}
}

function setSearchStatus(text) {
    const el = $('#duel-search-status');
    if (el) el.textContent = text;
}

function stopSearchTicker() {
    if (search && search.ticker) { clearInterval(search.ticker); search.ticker = null; }
}

function closeSearch() {
    stopSearchTicker();
    closeDialog($('#duel-search'), false);
}

export async function startDuel() {
    if (search && !search.done) return; // already searching
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    if (state.multiplayer) return;

    search = { startedAt: Date.now(), cancelled: false, done: false, hosting: false, started: false, ticker: null };
    const mySearch = search;
    openDialog($('#duel-search'), $('#btn-duel-cancel'));
    setSearchStatus(t('duelSearchStatus').replace('{s}', '0'));
    $('#duel-search-rating').textContent = t('duelYourRating').replace('{r}', String(cachedRating()));
    search.ticker = setInterval(() => {
        const s = Math.floor((Date.now() - mySearch.startedAt) / 1000);
        if (mySearch.cancelled || mySearch.fallback) return;
        setSearchStatus(t('duelSearchStatus').replace('{s}', String(s)));
    }, 500);

    await loadAllBanks();
    const meRes = await duelApi({ action: 'me' });
    if (meRes.ok && meRes.data) cacheRating(meRes.data.rating);
    state.duelRating = cachedRating();
    $('#duel-search-rating').textContent = t('duelYourRating').replace('{r}', String(state.duelRating));
    if (mySearch.cancelled) return;

    // Human matchmaking needs the duel service and a room to meet in. Inside a
    // Discord Activity the room is the voice channel's, so it is bot-only there.
    const canMatch = meRes.ok && mpOnline() && !isDiscordActivity();
    if (canMatch) {
        const q = await duelApi({ action: 'queue', name: getPlayerName() });
        if (mySearch.cancelled) return;
        if (q.ok && q.data && q.data.match) {
            if (await joinAsGuest(q.data.match, mySearch)) return;
        } else if (q.ok && q.data && q.data.waiting) {
            if (await hostAndWait(mySearch)) return;
        }
    } else {
        // Keep the search visible for a moment so the bot doesn't feel like a glitch.
        await delay(2500);
    }
    if (mySearch.cancelled || mySearch.started) return;
    mySearch.fallback = true;
    setSearchStatus(t('duelBotFallback'));
    await delay(1200);
    if (mySearch.cancelled || mySearch.started) return;
    startBotDuel();
}

async function joinAsGuest(match, mySearch) {
    setSearchStatus(t('duelFoundHuman').replace('{name}', safeDisplayName(match.name || '')));
    try {
        const { joinRoomByCode } = await import('./mp-ui.js');
        await joinRoomByCode(match.code);
        state.duel = { kind: 'human', opponent: match, ratingBefore: state.duelRating };
        mySearch.started = true;
        mySearch.done = true;
        closeSearch();
        return true;
    } catch (e) {
        console.warn('duel join failed:', e && e.message);
        return false;
    }
}

async function hostAndWait(mySearch) {
    const mp = window.GTL_MULTIPLAYER;
    try {
        await mp.hostRoom('all', { questions: DUEL_QUESTIONS, difficulty: 'all', timer: 'auto', ranked: true }, getPlayerName());
    } catch (e) {
        console.warn('duel host failed:', e && e.message);
        return false;
    }
    state.multiplayer = true;
    state.viewOnly = false;
    state.duel = { kind: 'human', hosting: true, ratingBefore: state.duelRating };
    mySearch.hosting = true;
    const offer = await duelApi({
        action: 'offer', code: mp.state.room?.code || mp.state.code, roomId: mp.state.roomId,
        name: getPlayerName(), avatar: discordAvatarUrl(getDiscordProfile()) || null
    });
    if (!offer.ok) { await abandonHostedRoom(); return false; }

    const deadline = mySearch.startedAt + SEARCH_SECONDS * 1000;
    while (Date.now() < deadline && !mySearch.cancelled && !mySearch.started) await delay(300);
    if (mySearch.cancelled || mySearch.started) return true;

    // Time's up. If the offer was taken a moment ago, give that player a few
    // seconds to arrive rather than closing the room in their face.
    const c = await duelApi({ action: 'cancel' });
    if (c.ok && c.data && c.data.taken) {
        const grace = Date.now() + LATE_JOIN_GRACE_MS;
        while (Date.now() < grace && !mySearch.cancelled && !mySearch.started) await delay(300);
        if (mySearch.started || mySearch.cancelled) return true;
    }
    await abandonHostedRoom();
    return false;
}

async function abandonHostedRoom() {
    try { await window.GTL_MULTIPLAYER.leaveRoom(); } catch (_) { /* already gone */ }
    state.multiplayer = false;
    state.duel = null;
}

export async function cancelDuelSearch() {
    if (!search) return;
    const s = search;
    s.cancelled = true;
    s.done = true;
    closeSearch();
    if (s.hosting && state.multiplayer && !s.started) {
        await duelApi({ action: 'cancel' });
        await abandonHostedRoom();
        returnHome();
    }
}

// Called on every multiplayer room update. In a ranked lobby the host starts
// the duel the moment a second player is seated — there is nothing to set up.
export function onRankedLobbyUpdate(room, players) {
    if (!room || !room.settings || room.settings.ranked !== true) return;
    const mp = window.GTL_MULTIPLAYER.state;
    const active = (players || []).filter((p) => !p.spectator);
    if (mp.isAdmin && active.length >= 2 && search && !search.started && !search.cancelled) {
        search.started = true;
        search.done = true;
        closeSearch();
        const opp = active.find((p) => p.id !== mp.playerId);
        if (state.duel) state.duel.opponent = { name: opp ? opp.name : '' };
        duelApi({ action: 'cancel' }); // the offer is spent either way
        lobbyStartGame();
    }
}

export function isRankedRoom(room) {
    return !!(room && room.settings && room.settings.ranked === true);
}

// ---------- Bot duel ----------
function botAccuracy(rating, difficulty) {
    const base = Math.max(0.3, Math.min(0.9, 0.55 + (rating - 1000) / 1200));
    const adj = difficulty === 'easy' ? 0.12 : difficulty === 'hard' ? -0.12 : 0;
    return Math.max(0.15, Math.min(0.95, base + adj));
}

export function startBotDuel() {
    closeSearch();
    if (search) { search.started = true; search.done = true; }
    const myRating = state.duelRating || cachedRating();
    const botRating = Math.max(100, myRating + Math.round((Math.random() - 0.5) * 120));
    const pool = state.allQuestions || [];
    const round = sampleAcrossBanks(pool, Math.min(DUEL_QUESTIONS, pool.length), shuffle);
    if (!round.length) { announce(t('loadFail')); return; }
    const plan = round.map((q) => ({
        correct: Math.random() < botAccuracy(botRating, q.difficulty),
        timeFrac: 0.2 + Math.random() * 0.55
    }));
    state.round = round;
    state.style = 'classic';
    state.daily = false;
    state.learn = false;
    state.review = false;
    state.focused = false;
    state.adaptive = false;
    state.duel = {
        kind: 'bot', botRating, ratingBefore: myRating, plan,
        botScore: 0, botStreak: 0, botCorrect: 0, botShown: 0, result: null
    };
    beginRound();
    renderDuelStrip();
}

// Advance the bot through one question. Called as each of the player's answers
// resolves, so the two scores move together on the strip.
export function duelBotStep(questionTime) {
    const d = state.duel;
    if (!d || d.kind !== 'bot' || d.botShown >= d.plan.length) return;
    const step = d.plan[d.botShown];
    d.botShown += 1;
    if (step.correct) {
        d.botStreak += 1;
        d.botCorrect += 1;
        const left = Math.max(0, Math.round((questionTime || 15) * (1 - step.timeFrac)));
        d.botScore += scoreAnswer(left, d.botStreak);
    } else {
        d.botStreak = 0;
    }
    renderDuelStrip();
}

export function renderDuelStrip() {
    const el = $('#duel-strip');
    if (!el) return;
    const d = state.duel;
    const show = !!d && d.kind === 'bot' && !state.multiplayer;
    el.classList.toggle('hidden', !show);
    if (!show) return;
    el.textContent = '';
    const side = (name, score, cls) => {
        const s = document.createElement('span');
        s.className = 'duel-side ' + cls;
        const n = document.createElement('span');
        n.className = 'duel-name';
        n.textContent = name;
        const v = document.createElement('strong');
        v.className = 'duel-score';
        v.textContent = formatScore(score);
        s.append(n, v);
        return s;
    };
    const vs = document.createElement('span');
    vs.className = 'duel-vs';
    vs.textContent = '⚔';
    el.append(
        side(`${t('duelYou')} (${d.ratingBefore})`, state.score, 'is-you'),
        vs,
        side(t('duelBotName').replace('{r}', String(d.botRating)), d.botScore, 'is-bot')
    );
}

// The bot answers every question it was dealt, even ones the player never
// reached — ending a duel early forfeits the rest.
function finishBotPlan(questionTime) {
    const d = state.duel;
    while (d && d.botShown < d.plan.length) duelBotStep(questionTime);
}

// Results for a finished duel (bot or human). Fills #challenge-result.
export async function finishDuel() {
    const d = state.duel;
    if (!d) return;
    const box = $('#challenge-result');
    let outcome;
    let oppLabel;
    let oppScore;
    let rating = null;

    if (d.kind === 'bot') {
        finishBotPlan(state.questionTime);
        oppScore = d.botScore;
        oppLabel = t('duelBotName').replace('{r}', String(d.botRating));
        outcome = state.score > oppScore ? 'win' : state.score < oppScore ? 'loss' : 'draw';
        recordPlay(false, false, state.score, false);
        const r = await duelApi({ action: 'bot', outcome, botRating: d.botRating });
        if (r.ok && r.data && r.data.saved) rating = { before: r.data.before, after: r.data.after };
    } else {
        const roomId = window.GTL_MULTIPLAYER?.state?.roomId;
        let r = null;
        for (let i = 0; i < 4 && roomId; i++) {
            r = await duelApi({ action: 'result', roomId });
            if (r.ok || r.status !== 409) break;
            await delay(1500); // the room may still be settling its last question
        }
        if (r && r.ok && r.data) {
            outcome = r.data.outcome;
            oppLabel = safeDisplayName(r.data.opponent?.name || '');
            oppScore = r.data.opponent?.score ?? 0;
            rating = { before: r.data.before, after: r.data.after };
        } else {
            const mp = window.GTL_MULTIPLAYER?.state;
            const me = mp?.players?.find((p) => p.id === mp.playerId);
            const opp = mp?.players?.find((p) => p.id !== mp.playerId && !p.spectator);
            oppLabel = opp ? safeDisplayName(opp.name) : '?';
            oppScore = opp ? opp.score : 0;
            const mine = me ? me.score : 0;
            outcome = mine > oppScore ? 'win' : mine < oppScore ? 'loss' : 'draw';
        }
    }
    if (rating) { cacheRating(rating.after); state.duelRating = rating.after; }
    d.result = { outcome, rating };

    if (!box) return;
    box.className = 'challenge-result duel-result ' + (outcome === 'win' ? 'won' : outcome === 'loss' ? 'lost' : 'draw');
    box.textContent = '';
    const head = document.createElement('strong');
    head.textContent = t(outcome === 'win' ? 'duelWon' : outcome === 'loss' ? 'duelLost' : 'duelDraw');
    const line = document.createElement('span');
    line.textContent = `${formatScore(state.score)} ${t('duelVs')} ${formatScore(oppScore)} · ${oppLabel}`;
    const rate = document.createElement('span');
    rate.className = 'duel-rating-change';
    if (rating) {
        const delta = rating.after - rating.before;
        rate.textContent = t('duelRatingChange')
            .replace('{from}', String(rating.before)).replace('{to}', String(rating.after))
            .replace('{delta}', (delta >= 0 ? '+' : '') + delta);
    } else {
        rate.textContent = t('duelRatingOffline');
    }
    box.append(head, line, rate);
    box.classList.remove('hidden');
}

// ---------- Rating board ----------
export async function fetchDuelBoard(limit = 20) {
    if (!supabaseConfigured()) return [];
    const rows = await sbFetch(`player_stats?select=player,duel_rating,duel_wins,duel_losses,duel_draws&or=(duel_wins.gt.0,duel_losses.gt.0,duel_draws.gt.0)&order=duel_rating.desc&limit=${limit}`);
    return rows || [];
}
