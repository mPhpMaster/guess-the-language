import { fetchDailyTop, fetchPersonalRank, fetchTopScores, lbScope, lbViewMode, submitDailyScore, submitScore, supabaseConfigured } from './api.js';
import { FRIENDS } from './constants.js';
import { $, announce, closeDialog, openDialog } from './dom.js';
import { MODES, challengeText, getLang, t } from './i18n.js';
import { appApiPrefix, discordAvatarUrl, getAppSessionToken, getDiscordProfile, getSettings, isDiscordActivity, safeDisplayName } from './identity.js';
import { modeLabel } from './mp-ui.js';
import { openProfileCard } from './profile.js';
import { dailyDateKey, markDailyDone } from './round.js';
import { getPlayerName } from './settings.js';
import { note } from './sound.js';
import { state, store } from './state.js';

export const AVATARS = ['🧑🏽', '👩🏼', '🧑🏻', '👩🏻‍🦰', '🧔🏽', '👨🏾', '👩🏽‍🦱', '🧑🏼‍🎤', '👨🏻‍💻', '👩🏾‍💻'];

export function avatarFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATARS[h % AVATARS.length];
}

// Per-player identity (color + icon) for multiplayer. The server assigns these
// at join time; these palettes are only a fallback for older rows.
export const MP_FALLBACK_COLORS = ['#2ec5ff', '#19f0c4', '#ffd874', '#ff7a9c', '#b18cff',
    '#5fd0ff', '#25d07d', '#ff9f5a', '#f78fff', '#8cff6b', '#ff5470', '#74e0ff'
];
export const MP_FALLBACK_ICONS = ['🦊', '🐼', '🦉', '🐙', '🦁', '🐯', '🐧', '🐸', '🦄', '🐢', '🦅', '🐲'];

export function mpVisualOf(player) {
    const players = (window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state.players) || [];
    let idx = players.findIndex((p) => p.id === player.id);
    if (idx < 0) idx = 0;
    return {
        name: player.name,
        icon: player.icon || MP_FALLBACK_ICONS[idx % MP_FALLBACK_ICONS.length],
        color: player.color || MP_FALLBACK_COLORS[idx % MP_FALLBACK_COLORS.length]
    };
}

// Real Discord avatar for a room player, linking the room record to the live
// Activity identity. Returns a CDN URL or null (→ caller falls back to the emoji
// badge). The local player uses their own signed-in profile; everyone else is
// matched by the discord_user_id stored on their room_players row against the
// Activity's connected-participants list (they're all in the same voice channel).
// Room-leaderboard avatar: the real Discord photo when we can resolve it, else the
// player's assigned emoji icon, else a name-derived emoji. Passed to getRoomLeaderboard.
export function mpRoomAvatarOf(player) {
    return mpDiscordAvatarUrl(player) || player.icon || avatarFor(player.name);
}
export function mpDiscordAvatarUrl(player) {
    const da = window.DISCORD_ACTIVITY;
    if (!da) return null;
    const mp = window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state;
    if (mp && player.id === mp.playerId) {
        const own = discordAvatarUrl(getDiscordProfile());
        if (own) return own;
    }
    const did = player.discord_user_id;
    if (did && typeof da.participant === 'function') {
        const part = da.participant(did);
        if (part && part.avatar) return discordAvatarUrl({ id: part.id, avatar: part.avatar });
    }
    return null;
}

// The leaderboard-view mode picker is only meaningful when browsing the board
// (not on a real round's results, which must show the mode you just played).
export function updateLbModeSwitch() {
    const wrap = $('#lb-mode-switch');
    if (!wrap) return;
    const show = state.viewOnly && supabaseConfigured();
    wrap.classList.toggle('hidden', !show);
    const sel = $('#lb-mode-select');
    if (sel) sel.value = lbViewMode();
}

// All-time / This-week toggle: shown on any real mode board (not the daily board).
export function updateLbScopeSwitch() {
    const wrap = $('#lb-scope-switch');
    if (!wrap) return;
    wrap.classList.toggle('hidden', !(supabaseConfigured() && !state.daily));
    wrap.querySelectorAll('.lb-scope-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.scope === lbScope());
    });
}

// The daily challenge shows its own board (today's daily_scores), not a mode board.
export async function buildDailyLeaderboard() {
    const note = $('#lb-note');
    const playerName = getPlayerName();
    $('#lb-mode-switch')?.classList.add('hidden');
    $('#lb-scope-switch')?.classList.add('hidden');
    $('.results-sub').textContent = `${t('dailyChallenge')} · ${dailyDateKey()}`;

    if (!supabaseConfigured()) { note.className = 'lb-note'; note.textContent = ''; return; }
    note.className = 'lb-note';
    note.textContent = t('lbLoading');
    try {
        if (state.score > 0) { await submitDailyScore(playerName, state.score); markDailyDone(); }
        const top = await fetchDailyTop(20);
        const list = (top || []).map((r, index) => ({
            id: r.id, name: safeDisplayName(r.player),
            avatar: r.avatar || avatarFor(r.player), score: r.score, rank: index + 1, you: false
        }));
        const myKey = safeDisplayName(playerName).trim().toLowerCase();
        const myAvatarNow = discordAvatarUrl(getDiscordProfile());
        for (const p of list) {
            if (safeDisplayName(p.name).trim().toLowerCase() === myKey) {
                p.you = true;
                if (myAvatarNow) p.avatar = myAvatarNow;
                break;
            }
        }
        if (state.score > 0) {
            const mine = list.find((p) => p.you);
            const personal = $('#personal-result');
            personal.textContent = `${t('personalRank')}: ${mine ? `#${mine.rank}` : '—'} · ${state.score} pts`;
            personal.classList.remove('hidden');
        }
        renderLeaderboard(list);
        note.className = 'lb-note online';
        note.textContent = t('lbOnline');
    } catch (e) {
        console.error('Daily leaderboard error:', e);
        note.className = 'lb-note offline';
        note.textContent = t('lbOffline');
    }
}

export async function buildResultsLeaderboard() {
    // Practice rounds aren't scored — no submit, no leaderboard.
    if (state.learn && !state.viewOnly) {
        $('#lb-mode-switch')?.classList.add('hidden');
        $('#lb-scope-switch')?.classList.add('hidden');
        $('#leaderboard').innerHTML = '';
        $('.results-sub').textContent = t('practiceRound');
        const note = $('#lb-note');
        note.className = 'lb-note';
        note.textContent = t('practiceNotSaved');
        return;
    }
    // Daily challenge results (played or just viewing today's board) use the daily board.
    if (state.daily) return buildDailyLeaderboard();
    // A real round's results always show the mode just played; only the standalone
    // leaderboard view lets you repoint the board to another mode.
    if (!state.viewOnly) state.lbViewMode = state.mode;
    updateLbModeSwitch();
    updateLbScopeSwitch();
    const note = $('#lb-note');
    const playerName = getPlayerName();

    if (supabaseConfigured()) {
        note.className = 'lb-note';
        note.textContent = t('lbLoading');
        try {
            // Only submit a real score; viewing scores (score 0) must not write a row.
            const me = state.score > 0 ? await submitScore(playerName, state.score) : null;
            const [top, personalRank] = await Promise.all([
                fetchTopScores(10),
                state.score > 0 ? fetchPersonalRank(state.score) : Promise.resolve(null)
            ]);
            const list = (top || []).map((r, index) => ({
                id: r.id,
                name: safeDisplayName(r.player),
                // Prefer the player's real profile photo; fall back to a
                // generated avatar when none was stored.
                avatar: r.avatar || avatarFor(r.player),
                score: r.score,
                multiplayer: !!r.multiplayer,
                rank: index + 1,
                you: false
            }));

            // Highlight the viewer's own entry even when just *browsing* the board
            // (no fresh score this session): match by case-insensitive display name.
            const myKey = safeDisplayName(playerName).trim().toLowerCase();
            if (myKey) {
                const myAvatarNow = discordAvatarUrl(getDiscordProfile());
                for (const p of list) {
                    if (safeDisplayName(p.name).trim().toLowerCase() === myKey) {
                        p.you = true;
                        if (myAvatarNow) p.avatar = myAvatarNow;
                        break;
                    }
                }
            }

            if (state.score > 0) {
                const myAvatar = discordAvatarUrl(getDiscordProfile()) || avatarFor(playerName);
                // Flag the player's row (already-flagged by name, else inserted id, else name+score).
                let mine = list.find((p) => p.you) || (me ? list.find((p) => p.id === me.id) : null);
                if (!mine) mine = list.find((p) => !p.you && p.name === playerName && p.score === state.score);
                if (mine) {
                    mine.you = true;
                    mine.avatar = myAvatar;
                } else list.push({
                    id: -1,
                    name: playerName,
                    avatar: myAvatar,
                    score: state.score,
                    rank: personalRank,
                    you: true
                });
            }

            if (state.score > 0) {
                const personal = $('#personal-result');
                personal.textContent = `${t('personalRank')}: ${personalRank ? `#${personalRank}` : '—'} · ${state.score} pts`;
                personal.classList.remove('hidden');
            }

            $('.results-sub').textContent = `${t('globalLeaderboard')} · ${modeLabel(lbViewMode())}`;
            renderLeaderboard(list);
            note.className = 'lb-note online';
            note.textContent = t('lbOnline');
            return;
        } catch (e) {
            console.error('Leaderboard error:', e);
            note.className = 'lb-note offline';
            note.textContent = t('lbOffline');
        }
    } else {
        note.className = 'lb-note';
        note.textContent = '';
    }

    // Offline / fallback: mock friends + the player.
    $('.results-sub').textContent = t('comparison');
    renderLeaderboard(FRIENDS.concat([{
        name: playerName,
        avatar: discordAvatarUrl(getDiscordProfile()) || '🧑‍💻',
        score: state.score,
        you: true
    }]));
}

export function currentModeLabel() {
    const mode = MODES[state.mode] || MODES.languages;
    const lang = getLang();
    const title = mode.title?.[lang] || mode.title?.en || [];
    return Array.isArray(title) ? title.join(' ') : String(title || mode.key || '');
}

export function renderLeaderboard(list) {
    const sorted = list.slice().sort((a, b) => b.score - a.score);
    let display = sorted.slice(0, 10);
    const youIdx = sorted.findIndex((p) => p.you);
    if (youIdx >= 10) {
        display = sorted.slice(0, 9);
        display.push(sorted[youIdx]);
    }
    const max = Math.max(...sorted.map((p) => p.score), 1);

    const lb = $('#leaderboard');
    lb.innerHTML = '';
    display.forEach((p, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        const placementBadge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const row = document.createElement('div');
        row.className = `lb-row ${rankClass}${p.you ? ' is-you' : ''}`;
        // Place number (1, 2, 3, …) shown at the start of every row.
        const rank = document.createElement('div');
        rank.className = 'lb-rank';
        rank.textContent = String(p.rank || i + 1);
        row.appendChild(rank);
        const label = document.createElement('div');
        label.className = 'lb-bar-fill';
        const displayName = safeDisplayName(p.name);
        label.textContent = `${displayName}${placementBadge ? ` ${placementBadge}` : ''} — ${p.score} pts`;
        if (p.multiplayer) {
            const mpTag = document.createElement('span');
            mpTag.className = 'lb-mp-tag';
            mpTag.textContent = ' 👥';
            mpTag.title = t('multiplayerScore');
            label.appendChild(mpTag);
        }
        if (p.you) {
            const tag = document.createElement('span');
            tag.className = 'lb-tag';
            tag.textContent = ' ' + t('you');
            label.appendChild(tag);
        }
        const wrap = document.createElement('div');
        wrap.className = 'lb-bar-wrap';
        const bg = document.createElement('div');
        bg.className = 'lb-bar-bg';
        wrap.appendChild(bg);
        wrap.appendChild(label);
        const avatar = document.createElement('div');
        avatar.className = 'lb-avatar';
        // A real Discord avatar URL renders as an image; anything else is emoji.
        if (typeof p.avatar === 'string' && /^https?:\/\//.test(p.avatar)) {
            const img = document.createElement('img');
            img.className = 'lb-avatar-img';
            img.src = p.avatar;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            avatar.appendChild(img);
        } else {
            avatar.textContent = p.avatar;
        }
        if (p.color) {
            avatar.style.background = p.color + '22';
            avatar.style.borderColor = p.color;
        }
        row.appendChild(avatar);
        row.appendChild(wrap);
        row.setAttribute('role', 'listitem');
        row.setAttribute('aria-label', `${t('personalRank')} ${p.rank || i + 1}, ${displayName}, ${p.score} points${p.multiplayer ? `, ${t('multiplayerScore')}` : ''}`);
        if (supabaseConfigured() && !p.you && Number(p.id) > 0 && getAppSessionToken()) {
            const report = document.createElement('button');
            report.className = 'lb-report text-btn';
            report.type = 'button';
            report.textContent = t('report');
            report.addEventListener('click', (ev) => { ev.stopPropagation(); openReportDialog(p); });
            row.appendChild(report);
        }

        // Click a leaderboard row to open that player's profile (rank per mode).
        // Only meaningful online, where there are real ranked scores to show.
        if (supabaseConfigured()) {
            row.classList.add('is-clickable');
            row.tabIndex = 0;
            row.title = `${displayName} — ${t('openPlayerCard')}`;
            const open = (ev) => {
                if (ev.target.closest && ev.target.closest('.lb-report')) return;
                openProfileCard(p);
            };
            row.addEventListener('click', open);
            row.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                openProfileCard(p);
            });
        }
        lb.appendChild(row);

        // Animate width. A 30% baseline keeps every bar wide enough for its label.
        const pct = 30 + 70 * (p.score / max);
        requestAnimationFrame(() => {
            setTimeout(() => {
                label.style.width = `${pct}%`;
            }, 60 + i * 120);
        });
    });
}

export let reportTarget = null;

export function openReportDialog(player) {
    reportTarget = player;
    $('#report-reason').value = 'offensive_name';
    $('#report-details').value = '';
    $('#report-error').classList.add('hidden');
    openDialog($('#report-dialog'), $('#report-reason'));
}

export async function submitLeaderboardReport() {
    const profile = getDiscordProfile();
    const token = getAppSessionToken();
    if (!reportTarget?.id || !profile?.id || !token || !supabaseConfigured()) return;
    const reason = $('#report-reason').value;
    const details = $('#report-details').value.trim().slice(0, 250);
    const allowed = ['offensive_name', 'impersonation', 'spam_other'];
    if (!allowed.includes(reason)) return;
    const button = $('#report-submit');
    button.disabled = true;
    $('#report-error').classList.add('hidden');
    try {
        const response = await fetch(`${appApiPrefix()}/api/report`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                score_id: reportTarget.id,
                reason,
                details: details || null
            })
        });
        if (!response.ok) throw new Error(`Report ${response.status}: ${await response.text()}`);
        closeDialog($('#report-dialog'));
        $('#lb-note').textContent = t('reportSuccess');
        announce(t('reportSuccess'));
    } catch (error) {
        const duplicate = /409|23505|duplicate/i.test(String(error));
        const message = duplicate ? t('reportDuplicate') : t('reportFailed');
        const box = $('#report-error');
        box.textContent = message;
        box.classList.remove('hidden');
        announce(message);
    } finally {
        button.disabled = false;
    }
}

// Encode the current mode + settings + score into a compact custom_id (max 64
// chars) that rides along a Discord challenge deep link. Example:
// "m=gamedev&d=hard&q=10&s=570".
export function buildChallengePayload() {
    return [
        `m=${state.mode}`,
        `d=${getSettings().difficulty}`,
        `q=${getSettings().questions}`,
        `s=${Math.max(0, state.score | 0)}`
    ].join('&');
}

// Parse a challenge custom_id back into { mode, difficulty, questions, score }.
// Returns null when the string carries no usable challenge.
export function parseChallengePayload(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const out = {};
    raw.split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k && v != null) out[k] = v;
    });
    const mode = MODES[out.m] ? out.m : null;
    const questions = [5, 10, 15, 20].includes(Number(out.q)) ? Number(out.q) : null;
    const difficulty = ['all', 'easy', 'medium', 'hard'].includes(out.d) ? out.d : null;
    const score = Number.isFinite(Number(out.s)) ? Math.max(0, Number(out.s) | 0) : null;
    if (!mode && score == null) return null;
    return { mode, questions, difficulty, score };
}

// Read a challenge off the web URL (?challenge=<payload>) — the link a shared
// "Challenge a friend" produces on the plain web build.
export function getChallengeFromUrl() {
    try {
        const p = new URLSearchParams(location.search).get('challenge');
        return p ? parseChallengePayload(decodeURIComponent(p)) : null;
    } catch {
        return null;
    }
}

// A challenged friend launches with these preset — mirror the challenger's mode
// and settings and remember the score to beat.
export function applyChallengeSettings(info) {
    if (info.mode) {
        state.mode = info.mode;
        localStorage.setItem('gtl_mode', info.mode);
    }
    const cur = getSettings();
    if (info.difficulty) cur.difficulty = info.difficulty;
    if (info.questions) cur.questions = info.questions;
    store.settings = cur;
    // Remember the score + mode to beat so we can grade the round afterwards and
    // clear the challenge cleanly if the player wanders off to another mode.
    state.challenge = { score: info.score != null ? info.score : 0, mode: info.mode || state.mode };
    state.challengeTarget = info.score;
}

export function hideChallengeBanner() {
    state.challenge = null;
    $('#challenge-banner')?.classList.add('hidden');
}

// On the results screen, if this round was played against a friend's challenge,
// show a "beaten / not beaten" verdict and turn the challenge button into a
// "challenge them back" action. A no-op (and label reset) for normal rounds.
export function renderChallengeVerdict(viewOnly) {
    const el = $('#challenge-result');
    const btn = $('#btn-challenge');
    const isChallenge = !viewOnly && !!state.challenge && !state.multiplayer && !state.learn
        && !state.daily && state.mode === state.challenge.mode;
    if (!isChallenge) {
        el?.classList.add('hidden');
        if (btn) btn.textContent = t('challenge');
        return;
    }
    const target = Math.max(0, state.challenge.score | 0);
    const won = state.score > target;
    if (el) {
        el.classList.remove('hidden');
        el.classList.toggle('won', won);
        el.classList.toggle('lost', !won);
        el.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'cr-headline';
        h.textContent = won ? t('challengeWon') : t('challengeLost');
        const p = document.createElement('div');
        p.className = 'cr-sub';
        p.textContent = (won ? t('challengeWonSub') : t('challengeLostSub'))
            .replace('{you}', String(state.score))
            .replace('{target}', String(target));
        el.appendChild(h);
        el.appendChild(p);
    }
    if (btn) btn.textContent = t('challengeBack');
}

export function challengeBannerText(info) {
    const modeName = modeLabel(info.mode || state.mode);
    const score = info.score != null ? info.score : 0;
    return getLang() === 'ar'
        ? `🎯 لقد تم تحدّيك! تجاوز ${score} نقطة في وضع «${modeName}».`
        : `🎯 You've been challenged! Beat ${score} points in ${modeName} mode.`;
}

export function showChallengeBanner(info) {
    const el = $('#challenge-banner');
    if (!el || !info) return;
    el.innerHTML = '';
    const msg = document.createElement('span');
    msg.className = 'challenge-banner-text';
    msg.textContent = challengeBannerText(info);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'challenge-banner-x';
    x.setAttribute('aria-label', t('challengeDismiss'));
    x.textContent = '✕';
    x.addEventListener('click', hideChallengeBanner);
    el.appendChild(msg);
    el.appendChild(x);
    el.classList.remove('hidden');
}

// Public web address of the game. On the plain web build that's the current
// origin; inside Discord/Electron the origin is a proxy/file, so fall back to
// the deployed site so the shared link is always playable in a browser.
export const GAME_PUBLIC_URL = 'https://guess-the-language-chi.vercel.app/';
export function gameShareBaseUrl() {
    if (document.documentElement.classList.contains('platform-web')) {
        return (location.origin + location.pathname).replace(/index\.html?$/i, '');
    }
    return GAME_PUBLIC_URL;
}

// A shareable link that opens the game preloaded with this challenge (same mode
// & settings, plus the score to beat).
export function buildChallengeUrl() {
    const base = gameShareBaseUrl().replace(/\/+$/, '/');
    return `${base}?challenge=${encodeURIComponent(buildChallengePayload())}`;
}

// Reveal the challenge link on the results screen as selectable text so the
// player can grab it even if the clipboard copy is blocked.
export function showChallengeLink(url) {
    const el = $('#challenge-link');
    if (!el) return;
    el.value = url;
    el.classList.remove('hidden');
    el.focus();
    el.select();
}

export function challengeFriend() {
    const url = buildChallengeUrl();
    const da = window.DISCORD_ACTIVITY;
    // Inside a Discord Activity, open the native share sheet so the player can
    // DM the challenge (score + settings + link) straight to a friend.
    if (isDiscordActivity() && da && typeof da.shareLink === 'function') {
        const msg = `${challengeText(state.score)}\n${url}`;
        const p = da.shareLink(msg, buildChallengePayload());
        if (p && typeof p.then === 'function') {
            showChallengeLink(url);
            p.then(
                (res) => {
                    if (res && (res.didSendMessage || res.didCopyLink)) {
                        flashButton('#btn-challenge', t('challengeSent'));
                    }
                },
                (err) => {
                    console.error('shareLink failed:', err);
                    flashButton('#btn-challenge', t('challengeFailed'));
                }
            );
            return;
        }
    }
    // Web / Electron: copy the link to the clipboard and show it on screen.
    showChallengeLink(url);
    navigator.clipboard ?.writeText(url).then(
        () => flashButton('#btn-challenge', t('challengeLinkCopied')),
        () => {}
    );
}

export function flashButton(sel, msg) {
    const b = $(sel);
    const old = b.innerHTML;
    b.innerHTML = msg;
    setTimeout(() => {
        b.innerHTML = old;
    }, 1600);
}
