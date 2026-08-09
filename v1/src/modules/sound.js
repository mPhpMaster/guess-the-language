import { getSettings } from './identity.js';

// ============================================================
//  Simple WebAudio sound effects (no asset files needed)
// ============================================================
export let audioCtx = null;
export let masterGain = null;

export function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; // keep everything gentle overall
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// A soft sine note with a smooth attack/release envelope (no harsh edges).
export function note(freq, when = 0, dur = 0.18, peak = 0.11) {
    if (!getSettings().sound) return;
    try {
        const ctx = ensureAudio();
        const t0 = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.025); // gentle fade-in
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // smooth fade-out
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.04);
    } catch (_) {
        /* audio not available — ignore */ }
}

// Light haptic buzz on mobile, gated by the same "sound effects" preference so a
// single toggle silences both. No-op where the Vibration API is unavailable.
export function haptic(pattern) {
    try {
        if (getSettings().sound && navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) { /* ignore */ }
}

export const sfx = {
    correct() {
        note(659, 0, 0.16, 0.12);
        note(988, 0.10, 0.24, 0.10);
        haptic(20);
    }, // soft rising chime
    wrong() {
        note(311, 0, 0.20, 0.10);
        note(233, 0.11, 0.30, 0.08);
        haptic([30, 40, 30]);
    }, // soft descending
    // Countdown beep for the final seconds — pitch rises as time runs out.
    tick(secondsLeft) {
        const f = secondsLeft <= 1 ? 880 : secondsLeft === 2 ? 740 : 620;
        note(f, 0, 0.09, 0.11);
    },
    finish() {
        [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.30, 0.09));
    } // gentle arpeggio
};
