import { $, announce, closeDialog, openDialog } from './dom.js';
import { t } from './i18n.js';
import { appApiPrefix, getAppSessionToken } from './identity.js';
import { state } from './state.js';

// ============================================================
//  Question feedback: "report this question" and per-question answer stats.
//  Both go through /api/questions with the signed session, so they exist only
//  where there is an identity (web + Discord); the desktop build skips them.
// ============================================================

let reportTarget = null;

async function questionsApi(body) {
    const token = getAppSessionToken();
    if (!token) return { ok: false, status: 0 };
    try {
        const res = await fetch(`${appApiPrefix()}/api/questions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return { ok: res.ok, status: res.status };
    } catch (_) {
        return { ok: false, status: 0 };
    }
}

// Opens the dialog for the question on screen (or a given one from the review list).
export function openQuestionReport(target) {
    const cur = target || state.current;
    if (!cur || cur.id == null) return;
    if (!getAppSessionToken()) { announce(t('qreportNeedLogin')); return; }
    reportTarget = { bank: cur.bank || 'languages', id: cur.id };
    // Reading a report mid-question shouldn't cost the player the question.
    $('#qreport-reason').value = 'wrong_answer';
    $('#qreport-details').value = '';
    $('#qreport-error')?.classList.add('hidden');
    openDialog($('#qreport-dialog'), $('#qreport-reason'));
}

export async function submitQuestionReport() {
    if (!reportTarget) return;
    const btn = $('#qreport-submit');
    if (btn) btn.disabled = true;
    const r = await questionsApi({
        action: 'report',
        bank: reportTarget.bank,
        id: reportTarget.id,
        reason: $('#qreport-reason').value,
        details: $('#qreport-details').value
    });
    if (btn) btn.disabled = false;
    const err = $('#qreport-error');
    if (r.ok || r.status === 409) {
        closeDialog($('#qreport-dialog'));
        announce(t(r.ok ? 'qreportThanks' : 'qreportDuplicateSent'));
        flashReportButton(t(r.ok ? 'qreportThanks' : 'qreportDuplicateSent'));
        reportTarget = null;
        return;
    }
    if (err) {
        err.textContent = t('qreportFailed');
        err.classList.remove('hidden');
    }
}

function flashReportButton(text) {
    const btn = $('#btn-report-q');
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = '✓ ' + text;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 2500);
}

// Post the round's outcomes for per-question difficulty stats. Fire-and-forget.
export function sendAnswerStats(history) {
    const answers = (history || [])
        .filter((h) => h && h.id != null && h.bank)
        .map((h) => ({ bank: h.bank, id: h.id, correct: !!h.correct }));
    if (!answers.length) return;
    questionsApi({ action: 'answers', answers }).catch(() => {});
}
