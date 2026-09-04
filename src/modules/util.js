/* Shared helpers used across modules. */

export function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
//  Room deep links (?room=CODE)
// ============================================================
// A hosted or joined room puts its code in the address bar, so copying the URL
// and opening it elsewhere lands in the same lobby. Only on a real http(s)
// origin: Electron runs from file:// (no query to share) and inside a Discord
// Activity the URL is the proxied Activity frame, whose room comes from the
// voice channel instead.
function canUseRoomUrl() {
    return typeof location !== 'undefined' &&
        /^https?:$/.test(location.protocol) &&
        typeof history !== 'undefined' && typeof history.replaceState === 'function';
}

export function roomUrlFor(code) {
    if (!code || !canUseRoomUrl()) return '';
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', String(code).toUpperCase());
    return url.toString();
}

export function roomFromUrl() {
    try {
        const raw = new URLSearchParams(location.search).get('room') || '';
        const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        return code.length === 4 ? code : '';
    } catch { return ''; }
}

export function setRoomInUrl(code) {
    if (!code || !canUseRoomUrl()) return;
    try {
        const url = new URL(location.href);
        url.searchParams.set('room', String(code).toUpperCase());
        history.replaceState(history.state, '', url.toString());
    } catch (e) { /* a hostile URL is not worth failing a join over */ }
}

export function clearRoomInUrl() {
    if (!canUseRoomUrl()) return;
    try {
        const url = new URL(location.href);
        if (!url.searchParams.has('room')) return;
        url.searchParams.delete('room');
        history.replaceState(history.state, '', url.toString());
    } catch (e) { /* ignore */ }
}
