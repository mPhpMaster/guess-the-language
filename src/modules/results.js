import { isPerfectRound, logError, recordPlay, supabaseConfigured } from './api.js';
import { $, setTitlebar, showScreen } from './dom.js';
import { formatScore } from './format.js';
import { t } from './i18n.js';
import { discordAvatarUrl, getDiscordProfile, isDiscordActivity, loadCrossOriginImage, safeDisplayName } from './identity.js';
import { buildResultsLeaderboard, currentModeLabel, renderChallengeVerdict, setBoardHeading } from './leaderboard.js';
import { modeLabel } from './mp-ui.js';
import { getPlayerName } from './settings.js';
import { sfx } from './sound.js';
import { recordAccuracy } from './home.js';
import { state, store } from './state.js';

// ============================================================
//  Results / leaderboard
// ============================================================
export async function endGame() {
    const viewOnly = !!state.viewOnly;

    if (!viewOnly && state.score > store.highScore(state.mode)) {
        store.setHighScore(state.mode, state.score);
    }
    if (!viewOnly) sfx.finish();
    showScreen('results');
    setTitlebar(`${t('tbResults')} — ${modeLabel(state.mode).toLowerCase()}`);

    // The whole round header goes away in leaderboard view — there is no round.
    $('#results-head').classList.toggle('hidden', viewOnly);
    // The board is the entire screen in that view, so the screen switches to the
    // design's left-aligned board layout instead of the centred results column.
    $('#screen-results').classList.toggle('is-leaderboard-view', viewOnly);
    $('#btn-challenge').classList.toggle('hidden', viewOnly);
    $('#btn-share-card')?.classList.toggle('hidden', viewOnly);
    $('#challenge-link').classList.add('hidden');
    // "Play again" only makes sense after an actual round — not when just browsing
    // the leaderboard (viewOnly), where there's no round to replay.
    $('#btn-replay').classList.toggle('hidden', viewOnly);
    $('#btn-replay').textContent = t('replay');
    $('#btn-menu').textContent = viewOnly ? t('mainMenu') : t('backMenu');
    setBoardHeading(t('comparison'), currentModeLabel());
    $('#result-stats').classList.toggle('hidden', viewOnly);
    if (viewOnly) $('#round-breakdown')?.classList.add('hidden');
    $('#answer-review').classList.toggle('hidden', viewOnly);
    $('#personal-result').classList.add('hidden');
    renderChallengeVerdict(viewOnly);

    if (!viewOnly) {
        countUp($('#final-score'), state.score, 900);
        $('#results-correct').textContent = String(state.correct);
        $('#results-total').textContent = String(state.round.length);
        renderRoundSummary();
        // Single-player round finished — log play-time + games, award XP and unlock
        // achievements (not a multiplayer win). Practice rounds are not scored/tracked.
        if (!state.multiplayer && !state.learn) {
            recordPlay(false, false, state.score, isPerfectRound());
            recordAccuracy(state.correct, state.round.length);
        }
    }
    await buildResultsLeaderboard();
}

export function formatSeconds(ms) {
    if (!Number.isFinite(ms)) return '—';
    return `${(ms / 1000).toFixed(1)}s`;
}

export function renderRoundSummary() {
    const history = state.roundHistory || [];
    const total = state.round.length || history.length;
    const answered = history.filter((item) => item.selectedAnswer).length;
    const average = history.length
        ? history.reduce((sum, item) => sum + item.responseTimeMs, 0) / history.length
        : NaN;
    const correctTimes = history.filter((item) => item.correct).map((item) => item.responseTimeMs);
    $('#stat-accuracy').textContent = total ? `${Math.round((state.correct / total) * 100)}%` : '0%';
    $('#stat-streak').textContent = String(state.bestStreak || 0);
    $('#stat-average').textContent = answered ? formatSeconds(average) : '—';
    $('#stat-fastest').textContent = correctTimes.length ? formatSeconds(Math.min(...correctTimes)) : '—';
    renderRoundBreakdown(history);
    renderAnswerReview(history);
}

// Per-category accuracy after a round: by bank when the round mixed several banks
// (All / daily), otherwise by difficulty. Highlights the strongest & weakest area.
export function renderRoundBreakdown(history) {
    const wrap = $('#round-breakdown');
    if (!wrap) return;
    const rows = (history || []).filter((h) => h.selectedAnswer || h.timedOut || h.correct === false || h.correct === true);
    const banks = new Set(rows.map((h) => h.bank).filter(Boolean));
    const useBank = banks.size > 1;
    const keyOf = (h) => useBank ? (h.bank || 'other') : (h.difficulty || 'other');
    const label = (k) => useBank ? modeLabel(k === 'algorithms' ? 'algorithms' : k) : (t('diff' + k.charAt(0).toUpperCase() + k.slice(1)) || k);

    const groups = new Map();
    rows.forEach((h) => {
        const k = keyOf(h);
        const g = groups.get(k) || { correct: 0, total: 0 };
        g.total += 1; if (h.correct) g.correct += 1;
        groups.set(k, g);
    });
    if (groups.size < 2) { wrap.classList.add('hidden'); return; }

    const entries = [...groups.entries()].map(([k, g]) => ({ k, label: label(k), pct: Math.round((g.correct / g.total) * 100), correct: g.correct, total: g.total }));
    entries.sort((a, b) => b.pct - a.pct);
    const best = entries[0], worst = entries[entries.length - 1];

    wrap.classList.remove('hidden');
    wrap.innerHTML = `<div class="rb-title">${t('breakdownTitle')}</div>`;
    const list = document.createElement('div');
    list.className = 'rb-list';
    entries.forEach((e) => {
        const row = document.createElement('div');
        row.className = 'rb-row' + (e === best ? ' is-best' : '') + (e === worst && best !== worst ? ' is-worst' : '');
        const name = document.createElement('span'); name.className = 'rb-name'; name.textContent = e.label;
        const bar = document.createElement('span'); bar.className = 'rb-bar';
        const fill = document.createElement('span'); fill.className = 'rb-fill'; fill.style.width = e.pct + '%';
        bar.appendChild(fill);
        const val = document.createElement('span'); val.className = 'rb-val'; val.textContent = `${e.correct}/${e.total}`;
        row.appendChild(name); row.appendChild(bar); row.appendChild(val);
        list.appendChild(row);
    });
    wrap.appendChild(list);
}

// Draw a shareable result card (score / mode / accuracy / name) to a PNG and
// share it (Web Share API with a file) or download it as a fallback.
export async function shareResultCard() {
    try {
        const w = 1080, h = 1350;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        // The card is drawn in the app's own language: the dark ground, one
        // accent, mono type. It used to be the pre-redesign navy gradient with a
        // cyan glow — canvas colours live here, not in the token layer, so the
        // stylesheet sweep never reached them.
        const INK = '#0b0d0c', PANEL = '#111514', LINE = '#ffffff14';
        const TEXT = '#f2f6f3', DIM = '#8a9490', DIMMER = '#6b736f', NEON = '#6ee7a0';
        const MONO = '"IBM Plex Mono", ui-monospace, monospace';
        const SANS = '"IBM Plex Sans", system-ui, sans-serif';
        // The webfonts are already linked in the document; wait for them or the
        // canvas silently falls back to a system face mid-draw.
        try { await document.fonts?.ready; } catch (_) { /* ignore */ }

        ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);

        // A window frame, echoing the app's title bar.
        const pad = 64, top = 96, bottom = h - 96;
        ctx.fillStyle = PANEL;
        ctx.fillRect(pad, top, w - pad * 2, bottom - top);
        ctx.strokeStyle = LINE; ctx.lineWidth = 2;
        ctx.strokeRect(pad, top, w - pad * 2, bottom - top);
        ctx.fillStyle = '#0f1211';
        ctx.fillRect(pad, top, w - pad * 2, 72);
        ctx.strokeRect(pad, top, w - pad * 2, 72);
        ctx.fillStyle = NEON;
        ctx.beginPath(); ctx.arc(pad + 34, top + 36, 8, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = DIM; ctx.font = `400 26px ${MONO}`;
        ctx.fillText('guess-the-language', pad + 60, top + 46);

        const cx = w / 2;
        ctx.textAlign = 'center';

        // The shell prompt the home screen opens with.
        // Mode names vary a lot in length, so the line is fitted to the card
        // rather than trusting one size: a long one used to run past the frame.
        const modeLine = (state.daily ? t('dailyChallenge') : currentModeLabel()).toLowerCase();
        const maxLine = w - pad * 2 - 160;
        let modeSize = 52;
        do {
            ctx.font = `600 ${modeSize}px ${MONO}`;
            if (ctx.measureText(modeLine).width <= maxLine) break;
            modeSize -= 2;
        } while (modeSize > 24);
        const lineW = ctx.measureText(modeLine).width;
        ctx.fillStyle = NEON;
        ctx.fillText('$', cx - lineW / 2 - modeSize * 0.62, 268);
        ctx.fillStyle = TEXT; ctx.fillText(modeLine, cx, 268);

        // The player's Discord avatar, or the app's mark when there isn't one.
        const avImg = await loadCrossOriginImage(discordAvatarUrl(getDiscordProfile(), 256));
        const r = 96, ay = 430;
        if (avImg) {
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(avImg, cx - r, ay - r, r * 2, r * 2);
            ctx.restore();
            ctx.strokeStyle = NEON; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.fillStyle = '#0d100f';
            ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = LINE; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = NEON; ctx.font = `700 72px ${MONO}`;
            ctx.fillText('$_', cx, ay + 26);
        }

        ctx.fillStyle = TEXT; ctx.font = `600 32px ${MONO}`;
        ctx.fillText(safeDisplayName(getPlayerName()) || 'Player', cx, ay + 172);

        // Score: the label above the number, as the results screen sets it.
        ctx.fillStyle = DIMMER; ctx.font = `400 28px ${MONO}`;
        ctx.fillText('F I N A L   S C O R E', cx, 740);
        ctx.fillStyle = TEXT; ctx.font = `700 180px ${MONO}`;
        ctx.fillText(formatScore(state.score), cx, 900);

        // One hairline, then the round's two figures.
        ctx.strokeStyle = LINE; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pad + 80, 968); ctx.lineTo(w - pad - 80, 968); ctx.stroke();

        const total = state.round.length || 1;
        const acc = Math.round((state.correct / total) * 100);
        const colW = (w - pad * 2 - 160) / 2;
        const leftX = pad + 80 + colW / 2, rightX = w - pad - 80 - colW / 2;
        ctx.fillStyle = NEON; ctx.font = `700 76px ${MONO}`;
        ctx.fillText(`${acc}%`, leftX, 1078);
        ctx.fillStyle = TEXT;
        ctx.fillText(`${state.correct}/${total}`, rightX, 1078);
        ctx.fillStyle = DIMMER; ctx.font = `400 26px ${SANS}`;
        ctx.fillText('Accuracy', leftX, 1126);
        ctx.fillText('Correct', rightX, 1126);
        ctx.beginPath(); ctx.moveTo(cx, 1030); ctx.lineTo(cx, 1136); ctx.stroke();

        ctx.fillStyle = DIMMER; ctx.font = `400 26px ${MONO}`;
        ctx.fillText('guess-the-language-chi.vercel.app', cx, bottom - 44);

        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) return;
        const file = new File([blob], 'guess-the-language.png', { type: 'image/png' });
        // Native share sheet (mobile / where allowed) — best experience when available.
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: t('shareResult') }); return; } catch (_) { /* fall through */ }
        }
        // Inside Discord the iframe blocks clipboard writes AND downloads, so neither
        // "copy image" nor "download" can work. The only reliable path is a real
        // https URL we can hand to the Discord SDK (openExternalLink / shareLink), so
        // upload the card to public storage first.
        let publicUrl = null;
        try { publicUrl = await uploadShareCard(blob); } catch (_) { publicUrl = null; }
        showShareOverlay(URL.createObjectURL(blob), blob, publicUrl);
    } catch (e) { console.warn('share card failed:', e); if (typeof logError === 'function') logError('share card: ' + e, { source: 'shareResultCard' }); }
}

// Upload a share-card PNG to the public `share-cards` bucket and return its public
// URL (or null on failure). Inside Discord the request is transparently proxied via
// the /supabase URL mapping; the returned URL uses the real host so it opens in the
// player's browser / embeds in a Discord message.
export async function uploadShareCard(blob) {
    if (!supabaseConfigured() || !blob) return null;
    const c = window.SUPABASE_CONFIG;
    const name = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const res = await fetch(`${c.url}/storage/v1/object/share-cards/${name}`, {
        method: 'POST',
        headers: { apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}`, 'Content-Type': 'image/png' },
        body: blob
    });
    if (!res.ok) return null;
    return `${c.url}/storage/v1/object/public/share-cards/${name}`;
}

// Overlay presenting the generated card. Actions adapt to the context: inside
// Discord (clipboard + downloads blocked) it offers open-in-browser / share-to-
// Discord / copy-link against the uploaded `publicUrl`; on web it offers the direct
// copy-image / download that actually work there.
export function showShareOverlay(url, blob, publicUrl) {
    let el = document.getElementById('share-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'share-overlay';
        el.className = 'share-overlay';
        el.innerHTML =
            '<div class="share-card-box">' +
            '<img class="share-img" id="share-img" alt="" />' +
            '<div class="share-actions" id="share-actions"></div>' +
            '<p class="share-hint" id="share-hint"></p></div>';
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { if (e.target === el) hideShareOverlay(); });
    }
    const hint = el.querySelector('#share-hint');
    const actions = el.querySelector('#share-actions');
    el.querySelector('#share-img').src = url;
    actions.innerHTML = '';

    const mkBtn = (label, cls, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${cls} btn-sm`;
        b.textContent = label;
        b.onclick = onClick;
        actions.appendChild(b);
        return b;
    };

    const inDiscord = isDiscordActivity();
    const da = window.DISCORD_ACTIVITY;

    if (inDiscord && publicUrl) {
        // Reliable inside the sandbox: hand the real https URL to the SDK.
        mkBtn(t('shareOpenImage'), 'btn-primary', () => { try { da.openExternal(publicUrl); } catch (_) {} });
        mkBtn(t('shareToDiscord'), 'btn-ghost', () => {
            try {
                const msg = `${safeDisplayName(getPlayerName()) || 'Player'} — ${state.score} pts • ${publicUrl}`;
                const p = da.shareLink ? da.shareLink(msg, null) : null;
                if (!p) da.openExternal(publicUrl);
            } catch (_) { try { da.openExternal(publicUrl); } catch (__) {} }
        });
        mkBtn(t('shareCopyLink'), 'btn-ghost', async () => {
            try { await navigator.clipboard.writeText(publicUrl); hint.textContent = t('shareLinkCopied2'); }
            catch (e) { hint.textContent = publicUrl; }
        });
        hint.textContent = t('shareDiscordHint');
    } else if (inDiscord) {
        // Upload failed — no https URL to hand off; the visible image is still saveable.
        hint.textContent = t('shareHint');
    } else {
        // Web / Electron: direct copy + download work here.
        mkBtn(t('copyImage'), 'btn-primary', async () => {
            try {
                if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('no-clipboard');
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                hint.textContent = t('copied');
            } catch (e) { hint.textContent = t('copyFailed'); }
        });
        mkBtn(t('download'), 'btn-ghost', () => {
            try {
                const a = document.createElement('a');
                a.href = url; a.download = 'guess-the-language.png'; a.rel = 'noopener';
                document.body.appendChild(a); a.click(); a.remove();
                hint.textContent = t('downloadStarted');
            } catch (e) { try { window.open(url, '_blank'); } catch (_) {} hint.textContent = t('downloadBlocked'); }
        });
        hint.textContent = t('shareHint');
    }

    mkBtn(t('close'), 'btn-ghost', hideShareOverlay);
    el._url = url;
    el.classList.add('show');
}
export function hideShareOverlay() {
    const el = document.getElementById('share-overlay');
    if (!el) return;
    el.classList.remove('show');
    if (el._url) { try { setTimeout(() => URL.revokeObjectURL(el._url), 3000); } catch (e) {} }
}

export function renderAnswerReview(history) {
    const list = $('#answer-review-list');
    list.innerHTML = '';
    const incorrect = history.filter((item) => !item.correct);
    const heading = $('#answer-review-title');
    if (heading) heading.textContent = `${t('missedTitle')} (${incorrect.length})`;
    if (!incorrect.length) {
        const empty = document.createElement('p');
        empty.className = 'review-empty';
        empty.textContent = t('noIncorrect');
        list.appendChild(empty);
        return;
    }
    incorrect.forEach((item) => {
        const article = document.createElement('article');
        article.className = 'review-item';
        const code = document.createElement('pre');
        code.textContent = item.panelText || item.prompt || '';
        const answers = document.createElement('p');
        // A timeout has no pick to report, so it says so instead of "you: —".
        if (item.selectedAnswer) {
            answers.append(
                labelSpan(t('answeredYou')),
                document.createTextNode(' ' + item.selectedAnswer + ' '),
                labelSpan(t('answeredAnswer'))
            );
        } else {
            answers.append(labelSpan(t('answeredTimeout')));
        }
        const right = document.createElement('span');
        right.className = 'review-answer';
        right.textContent = ' ' + item.correctAnswer;
        answers.appendChild(right);
        article.append(code, answers);
        list.appendChild(article);
    });
}

function labelSpan(text) {
    const el = document.createElement('span');
    el.className = 'review-label';
    el.textContent = text;
    return el;
}

export function countUp(el, target, durationMs) {
    const start = performance.now();

    function frame(now) {
        const p = Math.min(1, (now - start) / durationMs);
        el.textContent = formatScore(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
