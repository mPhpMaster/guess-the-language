import { $ } from './dom.js';
import { t } from './i18n.js';
import { appApiPrefix, getAppSessionToken, safeDisplayName } from './identity.js';
import { modeLabel } from './mp-ui.js';
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

export async function adminApi(action, extra) {
    const token = getAppSessionToken();
    if (!token) throw new Error('no session');
    const res = await fetch(`${appApiPrefix()}/api/admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action }, extra || {}))
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!res.ok) throw new Error((data && data.error) || `admin ${res.status}`);
    return data;
}

export function updateAdminButton() {
    const btn = $('#btn-admin');
    if (btn) btn.classList.toggle('hidden', !isAdmin());
}

export let __adminTab = 'reports';
export function openAdminPanel() {
    if (!isAdmin()) return;
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
                row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(safeDisplayName(u.player))}${u.banned ? ' <span class="admin-badge ban">ban</span>' : ''}</div>` +
                    `<div class="admin-row-sub">Lv ${u.level || 1} · ${u.games || 0} games · 🔥${u.day_streak || 0} · ${escapeHtml(seen)}</div></div>`;
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
