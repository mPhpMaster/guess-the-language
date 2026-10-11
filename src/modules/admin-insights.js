import { adminActionBtn, adminApi } from './admin.js';
import { $ } from './dom.js';
import { t } from './i18n.js';
import { modeLabel } from './mp-ui.js';
import { modeOfBank } from './round.js';
import { questionPageUrl } from './util.js';

// ============================================================
//  Admin: question reports + analytics tabs.
// ============================================================

let bankIndex = null;
async function questionIndex() {
    if (bankIndex) return bankIndex;
    const all = await window.gameAPI.getQuestions('all');
    bankIndex = new Map(all.map((q) => [`${q.bank}|${q.id}`, q]));
    return bankIndex;
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

function questionPreview(q) {
    if (!q) return '?';
    const text = q.question?.en || (q.correctLanguage ? `[${q.correctLanguage}]` : '');
    const snippet = String(q.codeSnippet || '').split('\n')[0].slice(0, 80);
    return [text, snippet].filter(Boolean).join(' — ');
}

const REASON_KEYS = {
    wrong_answer: 'qreportWrong', unclear: 'qreportUnclear', typo: 'qreportTypo',
    duplicate: 'qreportDuplicate', other: 'qreportOther'
};

export async function renderAdminQuestions(data) {
    const body = $('#admin-body');
    const list = (data && data.questions) || [];
    body.textContent = '';
    if (!list.length) { body.appendChild(el('p', 'admin-msg', t('adminQReportsEmpty'))); return; }
    const idx = await questionIndex().catch(() => new Map());
    list.forEach((g) => {
        const q = idx.get(`${g.bank}|${g.id}`);
        const card = el('div', 'admin-row admin-qreport');
        const main = el('div', 'admin-row-main');
        const name = el('div', 'admin-row-name', `${modeLabel(modeOfBank(g.bank))} #${g.id} `);
        name.appendChild(el('span', 'admin-badge', t('adminReportsCount').replace('{n}', String(g.count))));
        main.appendChild(name);
        main.appendChild(el('div', 'admin-row-sub', questionPreview(q)));
        if (q) {
            main.appendChild(el('div', 'admin-row-sub admin-qanswer', `✓ ${q.answer || q.correctLanguage || ''}`));
        }
        const reasons = Object.entries(g.reasons || {}).map(([r, n]) => `${t(REASON_KEYS[r] || 'qreportOther')} ×${n}`).join(' · ');
        main.appendChild(el('div', 'admin-row-sub', reasons));
        (g.details || []).forEach((d) => main.appendChild(el('div', 'admin-row-sub admin-qdetail', `“${d}”`)));
        card.appendChild(main);
        const acts = el('div', 'admin-row-acts');
        const open = el('button', 'admin-act ghost', t('adminOpenQuestion'));
        open.type = 'button';
        open.onclick = () => window.open(questionPageUrl(g.bank, g.id), '_blank', 'noopener');
        acts.appendChild(open);
        acts.appendChild(adminActionBtn(t('adminResolve'), 'ghost', () => adminApi('qreport_resolve', { bank: g.bank, id: g.id, status: 'resolved' })));
        acts.appendChild(adminActionBtn(t('adminDismiss'), 'ghost', () => adminApi('qreport_resolve', { bank: g.bank, id: g.id, status: 'dismissed' })));
        card.appendChild(acts);
        body.appendChild(card);
    });
}

function statCell(label, value) {
    const c = el('div', 'admin-stat');
    c.appendChild(el('strong', null, value == null ? '—' : String(value)));
    c.appendChild(el('span', null, label));
    return c;
}

function boardLabel(key) {
    const styles = { survival: 'styleSurvival', speedrun: 'styleSpeedrun', hardcore: 'styleHardcore' };
    return styles[key] ? t(styles[key]) : modeLabel(key);
}

export async function renderAdminStats(data) {
    const body = $('#admin-body');
    const s = (data && data.stats) || {};
    body.textContent = '';

    body.appendChild(el('h4', 'admin-h', t('adminActivePlayers')));
    const grid = el('div', 'admin-stats-grid');
    grid.append(
        statCell(t('adminActive1'), s.active_1d),
        statCell(t('adminActive7'), s.active_7d),
        statCell(t('adminActive30'), s.active_30d),
        statCell(t('adminTotalPlayers'), s.players_total),
        statCell(t('adminNewPlayers'), s.new_7d),
        statCell(t('adminReturning'), s.returning_pct != null ? `${s.returning_pct}%` : null),
        statCell(t('adminAnswers'), s.answers_total)
    );
    body.appendChild(grid);

    const plays = s.mode_plays || [];
    if (plays.length) {
        body.appendChild(el('h4', 'admin-h', t('adminModePlays')));
        const max = Math.max(...plays.map((p) => p.n), 1);
        plays.forEach((p) => {
            const row = el('div', 'rb-row');
            row.appendChild(el('span', 'rb-name', boardLabel(p.mode)));
            const bar = el('span', 'rb-bar');
            const fill = el('span', 'rb-fill');
            fill.style.width = `${Math.round((p.n / max) * 100)}%`;
            bar.appendChild(fill);
            row.appendChild(bar);
            row.appendChild(el('span', 'rb-val', String(p.n)));
            body.appendChild(row);
        });
    }

    const idx = await questionIndex().catch(() => new Map());
    const qList = (title, rows, fmt) => {
        if (!rows || !rows.length) return;
        body.appendChild(el('h4', 'admin-h', title));
        rows.forEach((r) => {
            const q = idx.get(`${r.bank}|${r.question_id}`);
            const row = el('div', 'admin-row');
            const main = el('div', 'admin-row-main');
            main.appendChild(el('div', 'admin-row-name', `${modeLabel(modeOfBank(r.bank))} #${r.question_id} · ${fmt(r)}`));
            main.appendChild(el('div', 'admin-row-sub', questionPreview(q)));
            row.appendChild(main);
            body.appendChild(row);
        });
    };
    qList(t('adminHardest'), s.hardest, (r) => `${Math.round((r.correct / r.attempts) * 100)}% / ${r.attempts}`);
    qList(t('adminMostReported'), s.most_reported, (r) => t('adminReportsCount').replace('{n}', String(r.n)));
    if (!body.childNodes.length || (s && Object.keys(s).length === 0)) {
        body.appendChild(el('p', 'admin-msg', t('adminEmpty')));
    }
}
