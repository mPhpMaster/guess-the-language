import { $, announce, closeDialog, openDialog } from './dom.js';
import { t } from './i18n.js';
import { appApiPrefix, getAppSessionToken, isDiscordActivity, safeDisplayName } from './identity.js';
import { adminJoinRoomFlow, modeLabel } from './mp-ui.js';
import { openProfileCard } from './profile.js';
import { escapeHtml } from './util.js';

// ============================================================
//  Admin panel — gated by a signed `adm` claim in the session token
// ============================================================
export function b64urlDecode(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return atob(s);
}
// Read (not verify — the server verifies) the session token's claims so the UI can
// decide whether to show the admin entry point. Real enforcement is server-side.
export function sessionClaims() {
    try {
        const tok = getAppSessionToken();
        if (!tok) return null;
        return JSON.parse(b64urlDecode(tok.split('.')[0]));
    } catch (_) { return null; }
}
export function isAdmin() {
    const c = sessionClaims();
    return !!(c && c.adm);
}

// ---- Passcode gate -----------------------------------------------------
// The unlock token lives in this module variable and NOWHERE else: not in
// localStorage, not in sessionStorage, not in the DOM. It dies with the page,
// and the passcode itself is never kept at all.
let __unlockToken = null;
let __unlockPending = null;

export function isAdminUnlocked() { return !!__unlockToken; }
export function clearAdminUnlock() { __unlockToken = null; }

export async function adminApi(action, extra, _retried) {
    const token = getAppSessionToken();
    if (!token) throw new Error('no session');
    const payload = Object.assign({ action }, extra || {});
    // `unlock` carries the passcode; every other call carries the unlock token.
    if (action !== 'unlock' && __unlockToken) payload.unlock = __unlockToken;
    const res = await fetch(`${appApiPrefix()}/api/admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!res.ok) {
        // The unlock expired (or was never obtained) — ask once, then retry.
        if (action !== 'unlock' && data && data.code === 'unlock_required' && !_retried) {
            __unlockToken = null;
            const ok = await promptAdminPasscode(t('adminUnlockExpired'));
            if (ok) return adminApi(action, extra, true);
        }
        const err = new Error((data && data.error) || `admin ${res.status}`);
        err.status = res.status;
        err.code = (data && data.code) || null;
        err.retryAfter = (data && data.retryAfter) || 0;
        throw err;
    }
    return data;
}

function unlockErrorText(err) {
    if (err && err.code === 'unlock_unconfigured') return t('adminUnlockUnset');
    if (err && err.code === 'unlock_locked') {
        return t('adminUnlockLocked').replace('{min}', String(Math.max(1, Math.ceil((err.retryAfter || 0) / 60))));
    }
    return t('adminUnlockWrong');
}

// Shows the passcode dialog and resolves true once the SERVER has accepted the
// code. A native window.prompt() is not an option here: Discord's Activity
// iframe can suppress it (same reason armButton() exists).
export function promptAdminPasscode(notice) {
    if (__unlockPending) return __unlockPending;
    const dlg = $('#admin-unlock');
    const input = $('#admin-unlock-input');
    const errEl = $('#admin-unlock-error');
    const submit = $('#admin-unlock-submit');
    const cancel = $('#admin-unlock-cancel');
    if (!dlg || !input || !submit) return Promise.resolve(false);

    __unlockPending = new Promise((resolve) => {
        let settled = false;
        const submitLabel = t('adminUnlockSubmit');

        const finish = (ok) => {
            if (settled) return;
            settled = true;
            input.value = '';
            submit.removeEventListener('click', onSubmit);
            cancel?.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
            dlg.removeEventListener('close', onCancel);
            submit.disabled = false;
            submit.textContent = submitLabel;
            closeDialog(dlg);
            __unlockPending = null;
            resolve(ok);
        };
        const onCancel = () => finish(false);
        const showError = (msg) => {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        };
        const onSubmit = async () => {
            const code = input.value;
            if (!code) { showError(t('adminUnlockWrong')); return; }
            submit.disabled = true;
            submit.textContent = t('adminUnlockChecking');
            errEl.classList.add('hidden');
            try {
                const data = await adminApi('unlock', { passcode: code });
                input.value = '';
                __unlockToken = (data && data.unlock) || null;
                if (!__unlockToken) throw new Error('no unlock token');
                finish(true);
            } catch (e) {
                // Never keep the attempted code around.
                input.value = '';
                showError(unlockErrorText(e));
                submit.disabled = false;
                submit.textContent = submitLabel;
                input.focus();
            }
        };
        const onKey = (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            onSubmit();
        };

        $('#admin-unlock-title').textContent = t('adminUnlockTitle');
        $('#admin-unlock-hint').textContent = t('adminUnlockHint');
        $('#admin-unlock-label').textContent = t('adminUnlockLabel');
        input.placeholder = t('adminUnlockPlaceholder');
        input.value = '';
        submit.textContent = submitLabel;
        submit.disabled = false;
        if (notice) { errEl.textContent = notice; errEl.classList.remove('hidden'); }
        else errEl.classList.add('hidden');

        submit.addEventListener('click', onSubmit);
        cancel?.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
        dlg.addEventListener('close', onCancel);
        openDialog(dlg, input);
    });
    return __unlockPending;
}

// Entry point for the 🛡️ Admin button: passcode first, panel second.
export async function requestAdminAccess() {
    if (!isAdmin()) return;
    if (__unlockToken) { openAdminPanel(); return; }
    if (await promptAdminPasscode()) openAdminPanel();
}

export function updateAdminButton() {
    const btn = $('#btn-admin');
    if (btn) btn.classList.toggle('hidden', !isAdmin());
}

export let __adminTab = 'reports';
export function openAdminPanel() {
    // Both gates are UI-level convenience; the server re-checks `adm` on every
    // request and the passcode-derived unlock token on every mutating one.
    if (!isAdmin() || !__unlockToken) return;
    $('#admin-modal').classList.remove('hidden');
    $('#admin-title').textContent = t('adminTitle');
    renderAdminTabs();
    loadAdminTab(__adminTab);
}
export function closeAdminPanel() { $('#admin-modal').classList.add('hidden'); }

export function renderAdminTabs() {
    const wrap = $('#admin-tabs');
    if (!wrap) return;
    const tabs = [
        ['reports', t('adminReports')],
        ['users', t('adminUsers')],
        ['live', t('adminLive')],
        ['bans', t('adminBans')]
    ];
    wrap.innerHTML = '';
    tabs.forEach(([key, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'admin-tab' + (key === __adminTab ? ' is-active' : '');
        b.textContent = label;
        b.onclick = () => loadAdminTab(key);
        wrap.appendChild(b);
    });
}

export async function loadAdminTab(tab) {
    __adminTab = tab;
    renderAdminTabs();
    const body = $('#admin-body');
    body.innerHTML = `<p class="admin-msg">${t('adminLoading')}</p>`;
    try {
        if (tab === 'reports') return renderAdminReports(await adminApi('reports'));
        if (tab === 'users') return renderAdminUsers();
        if (tab === 'live') return renderAdminLive(await adminApi('live'));
        if (tab === 'bans') return renderAdminBans(await adminApi('banned'));
    } catch (e) {
        body.innerHTML = `<p class="admin-msg admin-err">${t('adminError')}</p>`;
    }
}

// A destructive button that must be clicked twice: the first click arms it
// (shows "Confirm?"), the second within 3.5s runs the action. Works everywhere,
// unlike window.confirm() which Discord's iframe can suppress.
export function armButton(btn, run) {
    if (btn.dataset.armed === '1') { run(); return; }
    const original = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = t('adminConfirm');
    btn.classList.add('is-armed');
    const reset = () => { btn.dataset.armed = ''; btn.textContent = original; btn.classList.remove('is-armed'); };
    btn._armReset = reset;
    setTimeout(() => { if (btn.dataset.armed === '1') reset(); }, 3500);
}

export function adminActionBtn(label, cls, handler, danger) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-act ' + cls;
    b.textContent = label;
    b.onclick = () => {
        if (danger) {
            armButton(b, async () => { await runAdmin(b, handler); });
        } else {
            runAdmin(b, handler);
        }
    };
    return b;
}

export async function runAdmin(btn, handler) {
    btn.disabled = true;
    try {
        await handler();
        btn.textContent = t('adminDone');
        setTimeout(() => loadAdminTab(__adminTab), 500);
    } catch (e) {
        btn.disabled = false;
        if (btn._armReset) btn._armReset();
        btn.textContent = t('adminError');
    }
}

export function renderAdminReports(data) {
    const body = $('#admin-body');
    const reports = (data && data.reports) || [];
    if (!reports.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    reports.forEach((r) => {
        const card = document.createElement('div');
        card.className = 'admin-row admin-report status-' + (r.status || 'open');
        const who = r.score ? safeDisplayName(r.score.player) : ('#' + r.score_id);
        const meta = r.score ? `${r.score.score} · ${modeLabel(r.score.mode)}` : '';
        const head = document.createElement('div');
        head.className = 'admin-row-main';
        head.innerHTML = `<div class="admin-row-name">${escapeHtml(who)} <span class="admin-badge">${r.status || 'open'}</span></div>` +
            `<div class="admin-row-sub">${escapeHtml(meta)} · ${escapeHtml(r.reason || '')}${r.details ? ' — ' + escapeHtml(r.details) : ''}</div>`;
        card.appendChild(head);
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        if (r.score) {
            acts.appendChild(adminActionBtn(t('adminDeleteScore'), 'danger', () => adminApi('delete_score', { id: r.score_id }), true));
            acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: r.score.player, reason: r.reason }), true));
        }
        if (r.status === 'open') {
            acts.appendChild(adminActionBtn(t('adminResolve'), 'ghost', () => adminApi('resolve_report', { id: r.id, status: 'resolved' })));
            acts.appendChild(adminActionBtn(t('adminDismiss'), 'ghost', () => adminApi('resolve_report', { id: r.id, status: 'dismissed' })));
        }
        card.appendChild(acts);
        body.appendChild(card);
    });
}

export function renderAdminUsers(preload) {
    const body = $('#admin-body');
    body.innerHTML = `<div class="admin-search"><input type="text" id="admin-user-search" placeholder="${t('adminSearch')}" /></div><div id="admin-user-list"></div>`;
    const input = $('#admin-user-search');
    let timer = null;
    const run = async () => {
        const list = $('#admin-user-list');
        list.innerHTML = `<p class="admin-msg">${t('adminLoading')}</p>`;
        try {
            const data = await adminApi('users', { search: input.value.trim() });
            const users = (data && data.users) || [];
            if (!users.length) { list.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
            list.innerHTML = '';
            users.forEach((u) => {
                const row = document.createElement('div');
                row.className = 'admin-row';
                const seen = u.last_seen ? timeAgo(u.last_seen) : '';
                row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name"><span class="admin-name-btn" role="button" tabindex="0">${escapeHtml(safeDisplayName(u.player))}</span>${u.banned ? ' <span class="admin-badge ban">ban</span>' : ''}</div>` +
                    `<div class="admin-row-sub">Lv ${u.level || 1} · ${u.games || 0} games · 🔥${u.day_streak || 0} · ${escapeHtml(seen)}</div></div>`;
                // The name opens that player's profile card (same card the leaderboard uses).
                // Listener sits on the name itself, so the Reset/Ban buttons never trigger it.
                const nameBtn = row.querySelector('.admin-name-btn');
                if (nameBtn) {
                    nameBtn.title = t('openPlayerCard');
                    const open = (ev) => { ev.stopPropagation(); openProfileCard({ name: u.player }); };
                    nameBtn.addEventListener('click', open);
                    nameBtn.addEventListener('keydown', (ev) => {
                        if (ev.key !== 'Enter' && ev.key !== ' ') return;
                        ev.preventDefault();
                        open(ev);
                    });
                }
                const acts = document.createElement('div');
                acts.className = 'admin-row-acts';
                acts.appendChild(adminActionBtn(t('adminReset'), 'danger', () => adminApi('reset_profile', { player: u.player }), true));
                if (u.banned) acts.appendChild(adminActionBtn(t('adminUnban'), 'ghost', () => adminApi('unban', { player: u.player })));
                else acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: u.player, reason: 'admin' }), true));
                row.appendChild(acts);
                list.appendChild(row);
            });
        } catch (e) {
            list.innerHTML = `<p class="admin-msg admin-err">${t('adminError')}</p>`;
        }
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 300); });
    run();
}

// A join failure closes over nothing useful (the panel is already shut), so put
// the panel back up on the Live tab with the reason pinned above the rows.
async function reopenAdminLiveWithNotice(msg) {
    announce(msg);
    if (!isAdmin() || !isAdminUnlocked()) return;
    $('#admin-modal').classList.remove('hidden');
    $('#admin-title').textContent = t('adminTitle');
    renderAdminTabs();
    await loadAdminTab('live'); // awaited, so the notice survives the re-render
    const body = $('#admin-body');
    if (!body) return;
    const note = document.createElement('p');
    note.className = 'admin-msg admin-err';
    note.textContent = msg; // textContent — never innerHTML for a server string
    body.prepend(note);
}

// Rooms are reaped automatically, so "it's gone" is an ordinary outcome here.
function joinFailText(err) {
    const code = (err && err.code) || '';
    const status = (err && err.status) || 0;
    if (status === 404 || status === 410) return t('adminJoinGone');
    if (/room_gone|room_not_found|no_room|not_found/i.test(code)) return t('adminJoinGone');
    if (/not found|no longer|ended|gone/i.test((err && err.message) || '')) return t('adminJoinGone');
    return t('adminJoinFail');
}

// The Join button deliberately does NOT go through runAdmin(): that helper
// reloads the current tab afterwards, and by then we've left the panel entirely.
export function adminJoinBtn(p) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-act admin-join';
    const code = String(p.roomCode || '').trim().toUpperCase();
    const heads = Number(p.roomPlayers) || 0;
    // textContent, so an untrusted room code can never become markup.
    b.textContent = code
        ? `${t('adminJoin')} ${code}${heads ? ` (${heads})` : ''}`
        : t('adminJoin');
    b.title = p.ambiguous ? t('adminJoinAmbiguous') : t('adminJoinHint');
    b.onclick = async () => {
        b.disabled = true;
        closeAdminPanel();
        try {
            await adminJoinRoomFlow(p.roomId);
        } catch (e) {
            console.warn('admin join_room:', e);
            b.disabled = false;
            reopenAdminLiveWithNotice(joinFailText(e)).catch(() => {});
        }
    };
    return b;
}

export function renderAdminLive(data) {
    const body = $('#admin-body');
    const live = (data && data.live) || [];
    if (!live.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    const actLabel = { home: t('adminActivityHome'), lobby: t('adminActivityLobby'), playing: t('adminActivityPlaying') };
    live.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const server = p.guild_id ? `${t('adminServer')}: ${escapeHtml(p.guild_id)}` : t('adminNoServer');
        row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(safeDisplayName(p.player))} <span class="admin-badge live">${escapeHtml(actLabel[p.activity] || p.activity || '')}</span></div>` +
            `<div class="admin-row-sub">${escapeHtml(modeLabel(p.mode || ''))} · ${escapeHtml(p.platform || '')} · ${server} · ${escapeHtml(timeAgo(p.updated_at))}</div></div>`;
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        // Only rows where the player is actually in a room get a Join button, and
        // never inside Discord: rooms there are pinned to the voice-channel
        // instance, so the Activity would pull the admin straight back out.
        if (p.roomId && !isDiscordActivity()) acts.appendChild(adminJoinBtn(p));
        acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: p.player, reason: 'admin' }), true));
        row.appendChild(acts);
        body.appendChild(row);
    });
}

export function renderAdminBans(data) {
    const body = $('#admin-body');
    const banned = (data && data.banned) || [];
    if (!banned.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    banned.forEach((b) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(b.player)}</div>` +
            `<div class="admin-row-sub">${escapeHtml(b.reason || '')} · ${t('adminBannedBy')} ${escapeHtml(b.banned_by || '')} · ${escapeHtml(timeAgo(b.created_at))}</div></div>`;
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        acts.appendChild(adminActionBtn(t('adminUnban'), 'ghost', () => adminApi('unban', { player: b.player })));
        row.appendChild(acts);
        body.appendChild(row);
    });
}
export function timeAgo(iso) {
    try {
        const then = new Date(iso).getTime();
        const s = Math.max(0, Math.round((Date.now() - then) / 1000));
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.round(s / 60)}m`;
        if (s < 86400) return `${Math.round(s / 3600)}h`;
        return `${Math.round(s / 86400)}d`;
    } catch (_) { return ''; }
}
