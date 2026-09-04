// ============================================================
//  Shared number formatting
// ============================================================
// The design writes every score with a space between thousands ("6 235"), on
// the HUD, the results header, the board and the profile alike. A narrow
// no-break space keeps the two halves on one line and matches the drawing.
const THIN = '\u202f';

export function formatScore(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
}
