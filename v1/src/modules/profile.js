import { adminApi, armButton, isAdmin } from './admin.js';
import { sbFetch, supabaseConfigured } from './api.js';
import { $, announce, closeDialog, openDialog, showScreen } from './dom.js';
import { getLang, t } from './i18n.js';
import { discordAvatarUrl, getDiscordProfile, isDiscordActivity, safeDisplayName } from './identity.js';
import { avatarFor, buildResultsLeaderboard, mpVisualOf } from './leaderboard.js';
import { loadAllBanks, modeLabel, mpOnline, renderLobby } from './mp-ui.js';
import { mpRoundInfo, pushPresence } from './presence.js';
import { getPlayerName } from './settings.js';
import { sfx } from './sound.js';
import { state } from './state.js';

// A member pressed "Ask to Join" on someone's profile card: Discord launches the
// Activity for them and hands over the secret we published. If the voice-channel
// auto-join already landed them in that room there is nothing to do; otherwise
// join it by code.
export async function handleDiscordActivityJoin(secret) {
    const match = /^room:([A-Za-z0-9]{4})$/.exec(String(secret || ''));
    if (!match) return;
    const code = match[1].toUpperCase();
    const mp = window.GTL_MULTIPLAYER?.state;
    if (mp?.room?.code === code) return;
    if (!mpOnline()) return;

    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinRoom(code, getPlayerName());
        state.multiplayer = true;
        state.viewOnly = false;
        state.mpSyncKey = '';
        const joined = window.GTL_MULTIPLAYER.state;
        renderLobby(joined.room, joined.players);
        showScreen('lobby');
        pushPresence();
    } catch (err) {
        // Rooms already in progress reject a join-by-code; the player is normally
        // in via the voice instance anyway, so just tell them.
        console.error('Ask-to-Join failed:', err);
        announce(err.message || t('joinRequestFailed'));
    }
}

// ---------- In-app player card ----------

// room_players.id of the player whose card is open, so live score/round updates
// can refresh it in place.
export let playerCardId = null;
// ES module imports are read-only bindings, so other modules (events) clear this
// through the setter rather than assigning the export directly.
export function setPlayerCardId(value) { playerCardId = value; }

// The freshest row for a player id — list row closures outlive a re-render.
export function currentPlayerRow(playerId) {
    return (window.GTL_MULTIPLAYER?.state?.players || []).find((p) => p.id === playerId) || null;
}

// Status of one room_players row, as a localized label.
export function playerStatusLabel(player, room) {
    if (room?.status === 'finished') return t('statusFinished');
    if (player.spectator) return t('statusSpectating');
    if (room?.status === 'playing') return t('statusPlaying');
    return t('statusLobby');
}

export function setPlayerCardRow(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
}

// Clicking a row in #lobby-players / #mp-game-players lands here.
// Admin controls on ANY player card (leaderboard profile, lobby, in-game). Shown
// only to admins and never for your own card. Ban / full-reset, with a click-twice
// confirm; on success the card closes and a visible leaderboard refreshes.
export function cardAdminBtn(label, handler) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-act danger';
    b.textContent = label;
    b.onclick = () => armButton(b, async () => {
        b.disabled = true;
        try {
            await handler();
            b.textContent = t('adminDone');
            setTimeout(() => {
                closePlayerCard();
                if (state.currentScreen === 'results' && typeof buildResultsLeaderboard === 'function') buildResultsLeaderboard();
            }, 500);
        } catch (e) {
            b.disabled = false;
            if (b._armReset) b._armReset();
            b.textContent = t('adminError');
        }
    });
    return b;
}
export function renderCardAdminControls(name, isYou) {
    const box = $('#player-card-admin');
    if (!box) return;
    const who = safeDisplayName(name);
    if (!isAdmin() || isYou || !who) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'pca-label';
    label.textContent = t('adminButton');
    box.appendChild(label);
    box.appendChild(cardAdminBtn(t('adminBan'), () => adminApi('ban', { player: name, reason: 'admin' })));
    box.appendChild(cardAdminBtn(t('adminReset'), () => adminApi('reset_profile', { player: name })));
    box.classList.remove('hidden');
}

export function openPlayerCard(player) {
    const dlg = $('#player-card');
    if (!dlg || !player) return;
    // Room context: live-progress rows on. The profile stats + rankings are shown
    // too (loaded below), so a lobby card is the player's full profile + live round.
    $('#player-card-room')?.classList.remove('hidden');
    $('#btn-player-card-follow')?.classList.add('hidden'); // follow lives on profile cards
    $('#player-card-friends')?.classList.add('hidden');
    const titleEl = $('#player-card-title'); if (titleEl) titleEl.textContent = t('playerCardTitle');
    const hintEl = $('#player-card-hint'); if (hintEl) hintEl.textContent = t('playerCardHint');
    const mp = window.GTL_MULTIPLAYER.state;
    const room = mp.room || null;
    const { total, current } = mpRoundInfo();
    const vis = mpVisualOf(player);
    const isYou = player.id === mp.playerId;

    // Prefer the player's real Discord avatar when they're a connected participant
    // of this Activity; otherwise use the emoji identity the server assigned.
    const participant = window.DISCORD_ACTIVITY?.participant?.(player.discord_user_id) || null;
    const avatarUrl = participant ? discordAvatarUrl(participant) : null;
    const img = $('#player-card-avatar-img');
    const emoji = $('#player-card-avatar');
    if (avatarUrl) {
        img.src = avatarUrl;
        img.classList.remove('hidden');
        emoji.classList.add('hidden');
    } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        emoji.classList.remove('hidden');
        emoji.textContent = vis.icon;
        emoji.style.background = vis.color + '22';
        emoji.style.boxShadow = 'inset 0 0 0 2px ' + vis.color;
    }

    setPlayerCardRow('#player-card-name', safeDisplayName(player.name) + (isYou ? ` ${t('you')}` : ''));
    $('#player-card-host').classList.toggle('hidden', !player.is_host);
    setPlayerCardRow('#player-card-mode', modeLabel(room?.mode || state.mode));
    // No round to report before the game starts, and a spectator isn't in one.
    const noRound = !total || room?.status === 'lobby';
    setPlayerCardRow('#player-card-round', noRound ? '—' : `${room?.status === 'finished' ? total : current} / ${total}`);
    setPlayerCardRow('#player-card-score', String(player.score ?? 0));
    setPlayerCardRow('#player-card-correct', String(player.correct ?? 0));
    setPlayerCardRow('#player-card-streak', String(player.streak ?? 0));
    setPlayerCardRow('#player-card-status', playerStatusLabel(player, room));

    // "Ability to join": inside Discord, Discord's own invite sheet pulls people
    // into this Activity's voice channel — and the voice-channel auto-join drops
    // them straight into this room. On the web, share the room code instead.
    const invite = $('#btn-player-card-invite');
    if (invite) {
        const canInvite = isDiscordActivity() || !!room?.code;
        invite.classList.toggle('hidden', !canInvite);
        invite.textContent = isDiscordActivity() ? t('inviteToRoom') : t('copyCode');
    }
    // Host-only: promote another (non-host, non-spectator) player to host in the lobby.
    const mkHost = $('#btn-player-card-makehost');
    if (mkHost) {
        const canPromote = mp.isAdmin && !isYou && !player.is_host && !player.spectator && room?.status === 'lobby';
        mkHost.classList.toggle('hidden', !canPromote);
        mkHost.textContent = `👑 ${t('makeHost')}`;
        mkHost.onclick = async () => {
            try { await window.GTL_MULTIPLAYER.makeHost(player.id); closePlayerCard(); }
            catch (e) { const b = $('#player-card-error'); if (b) { b.textContent = e.message || 'error'; b.classList.remove('hidden'); } }
        };
    }
    $('#player-card-error')?.classList.add('hidden');
    renderCardAdminControls(player.name, isYou);

    // Load the player's global profile (stats + per-mode rankings) once per open —
    // not on every realtime refresh, which would re-fetch and flicker.
    const isNewOpen = playerCardId !== player.id;
    playerCardId = player.id;
    // No-ops when the card is already open, so refreshes don't steal focus.
    openDialog(dlg, $('#btn-player-card-close'));
    if (isNewOpen) loadPlayerProfileSections(safeDisplayName(player.name));
}

// Keep an open card in step with the realtime room feed.
export function refreshPlayerCard() {
    if (!playerCardId) return;
    const row = currentPlayerRow(playerCardId);
    if (!row) {
        closePlayerCard();
        return;
    }
    openPlayerCard(row);
}

export function closePlayerCard() {
    playerCardId = null;
    const dlg = $('#player-card');
    if (dlg?.open) closeDialog(dlg);
}

// Open the same card as a *profile* (from the leaderboard, home, anywhere a name
// is shown): the player's avatar plus their best score & rank in every mode.
// `entry` is a leaderboard/score shape { name, avatar?, you? } — not a room row.
// ---------- Friends / following (names are self-asserted, like scores) ----------
export let myFollowsCache = null; // Set of followee names for the current player
export async function loadMyFollows(force) {
    if (!supabaseConfigured()) return new Set();
    const me = safeDisplayName(getPlayerName());
    if (!me) return new Set();
    if (myFollowsCache && !force) return myFollowsCache;
    try {
        const rows = await sbFetch(`follows?select=followee&follower=eq.${encodeURIComponent(me)}`);
        myFollowsCache = new Set((rows || []).map((r) => safeDisplayName(r.followee)));
    } catch (e) { myFollowsCache = new Set(); }
    return myFollowsCache;
}
export function isFollowing(name) { return !!(myFollowsCache && myFollowsCache.has(safeDisplayName(name))); }
export async function followPlayer(name) {
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    if (!me || !who || me === who) return;
    (myFollowsCache = myFollowsCache || new Set()).add(who);
    try {
        await sbFetch('follows', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([{ follower: me, followee: who }]) });
    } catch (e) { console.warn('follow failed:', e.message); }
}
export async function unfollowPlayer(name) {
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    if (!me || !who) return;
    if (myFollowsCache) myFollowsCache.delete(who);
    try {
        await sbFetch(`follows?follower=eq.${encodeURIComponent(me)}&followee=eq.${encodeURIComponent(who)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    } catch (e) { console.warn('unfollow failed:', e.message); }
}
export async function setupFollowButton(name, isYou) {
    const btn = $('#btn-player-card-follow');
    if (!btn) return;
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    const show = supabaseConfigured() && !isYou && me && who && me !== who;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    await loadMyFollows();
    const paint = () => {
        btn.textContent = isFollowing(who) ? `✓ ${t('following')}` : `➕ ${t('follow')}`;
        btn.classList.toggle('is-following', isFollowing(who));
    };
    paint();
    btn.onclick = async () => {
        if (isFollowing(who)) await unfollowPlayer(who); else await followPlayer(who);
        paint();
    };
}
// The current player's following list (each with their best score), on their profile.
export async function renderFollowingList() {
    const wrap = $('#player-card-friends');
    const list = $('#player-card-friends-list');
    if (!wrap || !list) return;
    if (!supabaseConfigured()) { wrap.classList.add('hidden'); return; }
    await loadMyFollows(true);
    const names = [...(myFollowsCache || [])];
    if (!names.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    $('#player-card-friends-title').textContent = `${t('followingTitle')} · ${names.length}`;
    list.innerHTML = `<p class="player-card-rankings-empty">${t('lbLoading')}</p>`;
    const rows = await Promise.all(names.slice(0, 20).map(async (n) => {
        try {
            const r = await sbFetch(`scores?select=score,avatar&player=eq.${encodeURIComponent(n)}&order=score.desc&limit=1`);
            return { name: n, score: r && r[0] ? r[0].score : 0, avatar: r && r[0] ? r[0].avatar : null };
        } catch (e) { return { name: n, score: 0, avatar: null }; }
    }));
    rows.sort((a, b) => b.score - a.score);
    list.innerHTML = '';
    rows.forEach((r) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'friend-row';
        const av = document.createElement('span'); av.className = 'friend-av';
        if (typeof r.avatar === 'string' && /^https?:\/\//.test(r.avatar)) {
            const im = document.createElement('img'); im.src = r.avatar; im.alt = ''; im.referrerPolicy = 'no-referrer'; av.appendChild(im);
        } else { av.textContent = avatarFor(r.name); }
        const nm = document.createElement('span'); nm.className = 'friend-name'; nm.textContent = safeDisplayName(r.name);
        const sc = document.createElement('span'); sc.className = 'friend-score'; sc.textContent = fmtNum(r.score);
        row.append(av, nm, sc);
        row.addEventListener('click', () => openProfileCard({ name: r.name, avatar: r.avatar || undefined }));
        list.appendChild(row);
    });
}

export async function openProfileCard(entry) {
    const dlg = $('#player-card');
    if (!dlg || !entry || !entry.name) return;
    playerCardId = null; // not tied to a live room row
    const isYou = !!entry.you;

    $('#player-card-title').textContent = t('profileTitle');
    $('#player-card-hint').textContent = t('profileHint');
    $('#player-card-name').textContent = safeDisplayName(entry.name) + (isYou ? ` ${t('you')}` : '');
    $('#player-card-host').classList.add('hidden');

    // Avatar: a real photo URL wins; otherwise the generated emoji for the name.
    const img = $('#player-card-avatar-img');
    const emoji = $('#player-card-avatar');
    let url = (typeof entry.avatar === 'string' && /^https?:\/\//.test(entry.avatar)) ? entry.avatar : null;
    if (!url && isYou) url = discordAvatarUrl(getDiscordProfile());
    if (url) {
        img.src = url; img.classList.remove('hidden'); emoji.classList.add('hidden');
    } else {
        img.removeAttribute('src'); img.classList.add('hidden'); emoji.classList.remove('hidden');
        emoji.textContent = (typeof entry.avatar === 'string' && entry.avatar) ? entry.avatar : avatarFor(entry.name);
        emoji.style.background = ''; emoji.style.boxShadow = '';
    }

    // Profile context: hide the live-room rows + invite, show stats + rankings.
    $('#player-card-room').classList.add('hidden');
    $('#btn-player-card-invite').classList.add('hidden');
    $('#btn-player-card-makehost')?.classList.add('hidden'); // room-only control
    $('#player-card-error').classList.add('hidden');
    $('#player-card-friends').classList.add('hidden'); // reset; shown only on your own profile
    renderCardAdminControls(entry.name, isYou);

    openDialog(dlg, $('#btn-player-card-close'));
    loadPlayerProfileSections(entry.name);
    setupFollowButton(entry.name, isYou);
    if (isYou) renderFollowingList();
}

// Populate the shared player card's profile sections (stats + per-mode rankings +
// online/last-seen) for `name`. Used by the standalone profile card and, alongside
// the live-room rows, by the in-lobby player card. Best-effort and self-cancelling
// if the card is closed before the fetches resolve.
export async function loadPlayerProfileSections(name) {
    const dlg = $('#player-card');
    const statsBox = $('#player-card-profile-stats');
    const rankWrap = $('#player-card-rankings');
    const list = $('#player-card-rankings-list');
    if (!dlg || !statsBox || !rankWrap || !list) return;
    statsBox.classList.remove('hidden');
    statsBox.innerHTML = '';
    rankWrap.classList.remove('hidden');
    list.innerHTML = `<p class="player-card-rankings-empty">${supabaseConfigured() ? t('lbLoading') : '—'}</p>`;

    if (!supabaseConfigured()) { list.innerHTML = `<p class="player-card-rankings-empty">—</p>`; return; }
    try {
        const [stats, rows, activity] = await Promise.all([
            fetchPlayerStats(name),
            fetchPlayerRankings(name),
            fetchPlayerActivity(name)
        ]);
        if (!dlg.open) return; // closed/reopened meanwhile
        const ranks = rows.filter((r) => r.best != null && r.rank != null).map((r) => r.rank);
        const bestRank = ranks.length ? Math.min(...ranks) : null;
        renderProfileStats(statsBox, stats, bestRank, activity);
        renderProfileRankings(list, rows);

        // Online (active in the last few minutes) or last-seen timestamp.
        const lastSeen = $('#player-card-lastseen');
        const lastIso = (activity && activity.last_seen) || stats.lastPlayed;
        if (lastSeen && lastIso) {
            const online = isRecentlyActive(lastIso);
            lastSeen.textContent = online ? `🟢 ${t('online')}` : `${t('lastSeen')}: ${formatLastPlayed(lastIso)}`;
            lastSeen.classList.toggle('is-online', online);
            lastSeen.classList.remove('hidden');
        }
    } catch (e) {
        list.innerHTML = `<p class="player-card-rankings-empty">${t('lbOffline')}</p>`;
    }
}

export async function fetchPlayerActivity(name) {
    const clean = safeDisplayName(name);
    try {
        const rows = await sbFetch(`player_stats?select=games,mp_games,wins,seconds,last_seen,xp,level,day_streak,best_day_streak,perfect_games,achievements&player=eq.${encodeURIComponent(clean)}&limit=1`);
        return (rows && rows[0]) || null;
    } catch {
        return null;
    }
}

// "Online" proxy: active within the last 3 minutes (no true presence tracking).
export function isRecentlyActive(iso) {
    try {
        return (Date.now() - new Date(iso).getTime()) < 3 * 60 * 1000;
    } catch (e) {
        return false;
    }
}

// Aggregate profile stats derived from the player's score rows across all modes.
// (Win-rate / skill rating aren't tracked server-side, so only honest, derivable
// numbers are shown.)
export async function fetchPlayerStats(name) {
    const clean = safeDisplayName(name);
    const rows = await sbFetch(`scores?select=score,multiplayer,mode,created_at&player=eq.${encodeURIComponent(clean)}&limit=1000`) || [];
    const games = rows.length;
    const best = games ? Math.max(...rows.map((r) => r.score)) : 0;
    const total = rows.reduce((sum, r) => sum + (r.score || 0), 0);
    const avg = games ? Math.round(total / games) : 0;
    const mp = rows.filter((r) => r.multiplayer).length;
    const modes = new Set(rows.map((r) => r.mode)).size;
    const lastPlayed = rows.reduce((max, r) => (r.created_at && r.created_at > max ? r.created_at : max), '');
    return { games, best, avg, total, mp, modes, lastPlayed };
}

// ---------- Progression: XP / levels / achievements (Phase 2) ----------
// Level curve mirrors the server: level = floor(sqrt(xp/1000)) + 1.
export function levelFromXp(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 1000)) + 1); }
export function xpForLevel(level) { return Math.pow(Math.max(1, level) - 1, 2) * 1000; }
export function levelTitle(level) {
    if (level >= 11) return t('titleGuru');
    if (level >= 9) return t('titleExpert');
    if (level >= 7) return t('titleHacker');
    if (level >= 5) return t('titleCoder');
    if (level >= 3) return t('titleApprentice');
    return t('titleNovice');
}

// Every achievement the profile can display (id + emoji). Names come from i18n
// (ach_<id>). The server (record_progress) is the source of truth for unlocks.
export const ACHIEVEMENTS = [
    { id: 'rookie', icon: '🎮' }, { id: 'dedicated', icon: '🔁' }, { id: 'centurion', icon: '💯' },
    { id: 'first_win', icon: '🥇' }, { id: 'champion', icon: '🏆' }, { id: 'perfect', icon: '✨' },
    { id: 'flawless', icon: '🌟' }, { id: 'streak3', icon: '🔥' }, { id: 'streak7', icon: '⚡' },
    { id: 'marathon', icon: '⏱️' }, { id: 'level5', icon: '🚀' }, { id: 'level10', icon: '👑' }
];

export function celebrateAchievements(ids) {
    try {
        const names = ids.map((id) => t('ach_' + id) || id).join('  ·  ');
        showAchievementPop(`🏆 ${t('achievementUnlocked')}`, names);
        try { sfx.finish(); } catch (_) {}
    } catch (_) {}
}

// A brief top-of-screen banner when new achievements unlock at the end of a round.
export function showAchievementPop(title, body) {
    let el = document.getElementById('achievement-pop');
    if (!el) {
        el = document.createElement('div');
        el.id = 'achievement-pop';
        el.className = 'achievement-pop';
        el.setAttribute('role', 'status');
        el.innerHTML = '<div class="ach-pop-title"></div><div class="ach-pop-body"></div>';
        document.body.appendChild(el);
    }
    el.querySelector('.ach-pop-title').textContent = title;
    el.querySelector('.ach-pop-body').textContent = body;
    el.classList.add('show');
    if (el._t) clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 5200);
    announce(`${title}. ${body}`);
}

// Level + title + XP progress bar + daily streak, spanning the profile grid top.
export function renderLevelBar(box, activity) {
    const xp = Number(activity && activity.xp) || 0;
    const level = (activity && activity.level) || levelFromXp(xp);
    const base = xpForLevel(level);
    const span = Math.max(1, xpForLevel(level + 1) - base);
    const pct = Math.max(0, Math.min(100, Math.round(((xp - base) / span) * 100)));
    const streak = (activity && activity.day_streak) || 0;
    const bar = document.createElement('div');
    bar.className = 'pcs-levelbar';
    bar.innerHTML =
        `<div class="pcs-lvl-top">` +
        `<span class="pcs-lvl-badge">${t('levelShort')} ${level}</span>` +
        `<span class="pcs-lvl-title">${levelTitle(level)}</span>` +
        (streak >= 2 ? `<span class="pcs-streak" title="${t('dayStreak')}">🔥 ${streak}</span>` : '') +
        `</div>` +
        `<div class="pcs-xpbar"><div class="pcs-xpfill" style="width:${pct}%"></div></div>` +
        `<div class="pcs-xptext">${fmtNum(Math.max(0, xp - base))} / ${fmtNum(span)} XP</div>`;
    box.appendChild(bar);
}

// The full achievement grid: earned badges lit, the rest dimmed.
export function renderAchievements(box, activity) {
    const earned = new Set((activity && Array.isArray(activity.achievements)) ? activity.achievements : []);
    const wrap = document.createElement('div');
    wrap.className = 'pcs-ach';
    const title = document.createElement('div');
    title.className = 'pcs-ach-title';
    title.textContent = `${t('achievementsTitle')} · ${earned.size}/${ACHIEVEMENTS.length}`;
    const grid = document.createElement('div');
    grid.className = 'pcs-ach-grid';
    ACHIEVEMENTS.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'pcs-ach-item' + (earned.has(a.id) ? ' is-earned' : '');
        const name = t('ach_' + a.id) || a.id;
        item.title = name;
        item.innerHTML = `<span class="pcs-ach-icon">${a.icon}</span><span class="pcs-ach-name"></span>`;
        item.querySelector('.pcs-ach-name').textContent = name;
        grid.appendChild(item);
    });
    wrap.appendChild(title);
    wrap.appendChild(grid);
    box.appendChild(wrap);
}

// `bestRank` (min rank across modes) comes from the rankings fetch, so the whole
// profile costs no extra query. `null` when the player has no ranked score.
export function renderProfileStats(box, stats, bestRank, activity) {
    box.innerHTML = '';
    renderLevelBar(box, activity);
    const mpGames = activity ? activity.mp_games : 0;
    const wins = activity ? activity.wins : 0;
    const perfect = activity ? activity.perfect_games : 0;
    const winRate = mpGames > 0 ? `${Math.round((wins / mpGames) * 100)}%` : '—';
    const hours = activity && activity.seconds ? `${(activity.seconds / 3600).toFixed(1)}h` : '0h';
    const cells = [
        { label: t('statBestRank'), value: bestRank ? `#${bestRank}` : '—', hero: true },
        { label: t('statBest'), value: fmtNum(stats.best) },
        { label: t('statGames'), value: fmtNum(stats.games) },
        { label: t('statWinRate'), value: winRate },
        { label: t('statHours'), value: hours },
        { label: t('statAvg'), value: fmtNum(stats.avg) },
        { label: t('statMp'), value: fmtNum(mpGames || stats.mp) },
        { label: t('statPerfect'), value: fmtNum(perfect) }
    ];
    cells.forEach((c) => {
        const cell = document.createElement('div');
        cell.className = 'pcs-cell' + (c.hero ? ' pcs-hero' : '');
        const v = document.createElement('strong');
        v.className = 'pcs-value';
        v.textContent = c.value;
        const l = document.createElement('span');
        l.className = 'pcs-label';
        l.textContent = c.label;
        cell.appendChild(v);
        cell.appendChild(l);
        box.appendChild(cell);
    });
    renderAchievements(box, activity);
}

// Compact thousands (35490 -> "35,490"), keeping small numbers plain.
export function fmtNum(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US');
}

// Absolute date + time of the player's most recent score (their last activity).
export function formatLastPlayed(iso) {
    try {
        return new Date(iso).toLocaleString(getLang() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
        return '—';
    }
}

export const RANKABLE_MODES = ['languages', 'cybersecurity', 'devops', 'network', 'gamedev', 'algorithms', 'all'];

// The player's best score + rank in every mode (approximate rank: count of score
// rows above their best, +1 — same method as the personal rank on results).
export async function fetchPlayerRankings(name) {
    const clean = safeDisplayName(name);
    return Promise.all(RANKABLE_MODES.map(async (mode) => {
        try {
            const rows = await sbFetch(`scores?select=score&mode=eq.${encodeURIComponent(mode)}&player=eq.${encodeURIComponent(clean)}&order=score.desc&limit=1`);
            const best = rows && rows[0] ? rows[0].score : null;
            const rank = best != null ? await countScoresAbove(mode, best) : null;
            return { mode, best, rank };
        } catch {
            return { mode, best: null, rank: null };
        }
    }));
}

export async function countScoresAbove(mode, score) {
    const c = window.SUPABASE_CONFIG;
    const url = `${c.url}/rest/v1/scores?select=id&mode=eq.${encodeURIComponent(mode)}&score=gt.${score}`;
    const res = await fetch(url, {
        method: 'HEAD',
        headers: { apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}`, Prefer: 'count=exact' }
    });
    if (!res.ok) return null;
    const count = Number((res.headers.get('content-range') || '').split('/')[1]);
    return Number.isFinite(count) ? count + 1 : null;
}

export function renderProfileRankings(list, rows) {
    list.innerHTML = '';
    const ranked = (rows || []).filter((r) => r.best != null);
    if (!ranked.length) {
        const p = document.createElement('p');
        p.className = 'player-card-rankings-empty';
        p.textContent = t('noRankings');
        list.appendChild(p);
        return;
    }
    rows.forEach((r) => {
        if (r.best == null) return;
        const row = document.createElement('div');
        row.className = 'player-card-rank-row';
        const m = document.createElement('span');
        m.className = 'pcr-mode';
        m.textContent = modeLabel(r.mode);
        const medal = r.rank === 1 ? ' 🥇' : r.rank === 2 ? ' 🥈' : r.rank === 3 ? ' 🥉' : '';
        const rk = document.createElement('span');
        rk.className = 'pcr-rank';
        rk.textContent = (r.rank ? `#${r.rank}` : '—') + medal;
        const sc = document.createElement('span');
        sc.className = 'pcr-score';
        sc.textContent = `${r.best} pts`;
        row.appendChild(m);
        row.appendChild(rk);
        row.appendChild(sc);
        list.appendChild(row);
    });
}
