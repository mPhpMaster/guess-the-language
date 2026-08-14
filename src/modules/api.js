import { MODES } from './i18n.js';
import { discordAvatarUrl, getDiscordProfile, isDiscordActivity, safeDisplayName } from './identity.js';
import { celebrateAchievements } from './profile.js';
import { dailyDateKey } from './round.js';
import { getPlayerName } from './settings.js';
import { state } from './state.js';

// ---------- Supabase REST leaderboard (optional, configured via window.SUPABASE_CONFIG) ----------
export function supabaseConfigured() {
    const c = window.SUPABASE_CONFIG;
    return !!(c && c.url && c.anonKey);
}

export async function sbFetch(pathQuery, options = {}) {
    const c = window.SUPABASE_CONFIG;
    const res = await fetch(`${c.url}/rest/v1/${pathQuery}`, {
        ...options,
        headers: {
            apikey: c.anonKey,
            Authorization: `Bearer ${c.anonKey}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    // Tolerate empty bodies: return=minimal inserts come back 201/204 with no body,
    // so res.json() would throw "Unexpected end of JSON input".
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ---------- Error logging to Supabase (best-effort; must NEVER throw) ----------
// Any runtime error — uncaught, unhandled rejection, or console.error — is written
// to the `error_logs` table so it can be inspected server-side later. Deduped and
// throttled so a repeating error can't flood the table.
export let __cachedAppVersion = null;
export const __errLogThrottle = new Map();

export function logError(message, extra) {
    try {
        if (!supabaseConfigured()) return;
        const msg = String(message == null ? 'unknown error' : (message.message || message)).slice(0, 2000);
        if (!msg || msg === 'null' || msg === 'undefined') return;
        const ex = extra || {};
        const key = (ex.source || '') + '|' + msg.slice(0, 180);
        const now = Date.now();
        if (now - (__errLogThrottle.get(key) || 0) < 15000) return; // 1 per 15s per unique error
        __errLogThrottle.set(key, now);
        let platform = 'web';
        try { if (isDiscordActivity()) platform = 'discord'; else if (/electron/i.test(navigator.userAgent)) platform = 'electron'; } catch (_) {}
        const row = {
            level: ex.level || 'error',
            source: ex.source || 'manual',
            message: msg,
            stack: ex.stack ? String(ex.stack).slice(0, 8000) : null,
            app_version: __cachedAppVersion,
            platform,
            player: (() => { try { return getPlayerName() || null; } catch (_) { return null; } })(),
            url: (() => { try { return location.href; } catch (_) { return null; } })(),
            context: Object.assign({ mode: state && state.mode, ua: navigator.userAgent }, ex.context || {})
        };
        sbFetch('error_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([row]) }).catch(() => {});
    } catch (_) { /* logging must never break the app */ }
}
window.GTL_LOG_ERROR = logError;

export let __errorLoggingInstalled = false;
export function setupErrorLogging() {
    if (__errorLoggingInstalled) return;
    __errorLoggingInstalled = true;
    try { window.appWindow?.getVersion?.().then((v) => { __cachedAppVersion = v || null; }).catch(() => {}); } catch (_) {}
    window.addEventListener('error', (e) => {
        logError((e && (e.message || e.error)) || 'window error', {
            source: 'window.onerror',
            stack: e && e.error && e.error.stack,
            context: { filename: e && e.filename, lineno: e && e.lineno, colno: e && e.colno }
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e && e.reason;
        logError((r && (r.message || r)) || 'unhandled promise rejection', { source: 'unhandledrejection', stack: r && r.stack });
    });
    // Route console.error through the logger so caught-and-logged failures (exactly
    // the ones worth debugging) are captured too. logError never calls console.error,
    // so there is no recursion.
    const origErr = console.error.bind(console);
    console.error = function (...args) {
        origErr(...args);
        try { logError(args.map((a) => (a && a.stack) ? a.stack : String((a && a.message) ? a.message : a)).join(' '), { source: 'console.error' }); } catch (_) {}
    };
}

// Record a finished game into player_stats (games, multiplayer wins, seconds
// played, last activity). Best-effort — a failure must never affect gameplay.
export function recordPlay(multiplayer, won, xp, perfect) {
    if (!supabaseConfigured()) { state.gameStartMs = null; return; }
    const seconds = state.gameStartMs ? Math.round((Date.now() - state.gameStartMs) / 1000) : 0;
    state.gameStartMs = null;
    const name = getPlayerName();
    if (!name) return;
    // record_progress also awards XP/level, updates the daily streak, and unlocks
    // achievements atomically, returning what was newly unlocked for a celebration.
    sbFetch('rpc/record_progress', {
        method: 'POST',
        body: JSON.stringify({
            p_player: name, p_seconds: seconds, p_multiplayer: !!multiplayer, p_won: !!won,
            p_xp: Math.max(0, Math.round(xp || 0)), p_perfect: !!perfect
        })
    }).then((res) => {
        const info = Array.isArray(res) ? res[0] : res;
        const unlocked = info && info.new_achievements;
        if (Array.isArray(unlocked) && unlocked.length) celebrateAchievements(unlocked);
    }).catch((e) => console.warn('record_progress failed:', e.message));
}

// True when the local player answered every question in the round correctly.
export function isPerfectRound() {
    return state.round && state.round.length > 0 && state.correct === state.round.length;
}

// True when the local player has the (non-spectator) top score in the room.
export function amIWinner() {
    const mp = window.GTL_MULTIPLAYER?.state;
    if (!mp || !Array.isArray(mp.players) || !mp.players.length) return false;
    const me = mp.players.find((p) => p.id === mp.playerId);
    if (!me || me.spectator) return false;
    const top = Math.max(...mp.players.filter((p) => !p.spectator).map((p) => p.score || 0));
    return top > 0 && me.score === top;
}

export function submitScore(player, score, mode = state.mode, multiplayer = false) {
    return sbFetch('scores', {
        method: 'POST',
        headers: {
            Prefer: 'return=representation'
        },
        body: JSON.stringify([{
            player: safeDisplayName(player),
            score,
            mode,
            multiplayer,
            avatar: discordAvatarUrl(getDiscordProfile()) || null
        }])
    }).then((rows) => (Array.isArray(rows) ? rows[0] : null));
}

// Daily Challenge: submit today's score to the separate daily board. The unique
// (day,player) + resolution=ignore-duplicates means the FIRST score of the day
// stands and replays are silently ignored (no cheating a better result).
export function submitDailyScore(player, score) {
    return sbFetch('daily_scores', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([{
            day: dailyDateKey(),
            player: safeDisplayName(player),
            score: Math.max(0, Math.round(score || 0)),
            avatar: discordAvatarUrl(getDiscordProfile()) || null
        }])
    });
}

export async function fetchDailyTop(limit = 20) {
    const rows = await sbFetch(`daily_scores?select=id,player,score,avatar&day=eq.${dailyDateKey()}&order=score.desc&limit=${limit}`);
    return rows || [];
}

// Register every player's score from a finished multiplayer room in one insert,
// each flagged as a multiplayer result. return=minimal -> 204 (no body to parse).
export function submitMpScores(rows) {
    if (!rows.length) return Promise.resolve(null);
    return sbFetch('scores', {
        method: 'POST',
        headers: {
            Prefer: 'return=minimal'
        },
        body: JSON.stringify(rows.map((row) => ({ ...row, player: safeDisplayName(row.player) })))
    });
}

// Which mode's leaderboard to show. Defaults to the play mode, but the leaderboard
// screen's own mode picker can point it elsewhere without leaving the screen.
export function lbViewMode() {
    return (state.lbViewMode && MODES[state.lbViewMode]) ? state.lbViewMode : state.mode;
}

// Leaderboard time scope: all-time (default) or just the current week.
export function lbScope() { return state.lbScope === 'week' ? 'week' : 'all'; }
// Start of the current week — Monday 00:00 UTC.
export function weekStartIso() {
    const d = new Date();
    const backToMon = (d.getUTCDay() + 6) % 7; // 0 = Monday
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - backToMon)).toISOString();
}
// PostgREST filter fragment for the chosen scope (empty for all-time).
export function lbScopeFilter() { return lbScope() === 'week' ? `&created_at=gte.${encodeURIComponent(weekStartIso())}` : ''; }

export async function fetchTopScores(limit = 10) {
    // Pull a wide score-desc window, then keep only each player's single best row
    // so one person can't occupy several slots (deduped by case-insensitive name).
    const rows = await sbFetch(`scores?select=id,player,score,multiplayer,avatar&mode=eq.${encodeURIComponent(lbViewMode())}${lbScopeFilter()}&order=score.desc&limit=200`);
    const best = new Map();
    for (const r of rows || []) {
        const key = safeDisplayName(r.player).trim().toLowerCase();
        if (!best.has(key)) best.set(key, r); // score-desc → first seen is the best
    }
    return Array.from(best.values()).slice(0, limit);
}

export async function fetchPersonalRank(score) {
    if (!supabaseConfigured() || score <= 0) return null;
    const c = window.SUPABASE_CONFIG;
    const url = `${c.url}/rest/v1/scores?select=id&mode=eq.${encodeURIComponent(lbViewMode())}${lbScopeFilter()}&score=gt.${score}`;
    const res = await fetch(url, {
        method: 'HEAD',
        headers: {
            apikey: c.anonKey,
            Authorization: `Bearer ${c.anonKey}`,
            Prefer: 'count=exact'
        }
    });
    if (!res.ok) return null;
    const range = res.headers.get('content-range') || '';
    const count = Number(range.split('/')[1]);
    return Number.isFinite(count) ? count + 1 : null;
}
