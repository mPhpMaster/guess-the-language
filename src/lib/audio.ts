import { settings } from './settings';

/* ============================================================
   WebAudio sound effects — no asset files needed.
   ============================================================ */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function ensureAudio(): AudioContext | null {
    try {
        if (!audioCtx) {
            const Ctor = window.AudioContext ?? window.webkitAudioContext;
            if (!Ctor) return null;
            audioCtx = new Ctor();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.5; // keep everything gentle overall
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') void audioCtx.resume();
        return audioCtx;
    } catch {
        return null;
    }
}

/** A soft sine note with a smooth attack/release envelope (no harsh edges). */
function note(freq: number, when = 0, dur = 0.18, peak = 0.11): void {
    if (!settings().sound) return;
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
        const start = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + dur + 0.04);
    } catch {
        /* audio not available — ignore */
    }
}

/** Light haptic buzz on mobile, gated by the same "sound effects" preference. */
function haptic(pattern: number | readonly number[]): void {
    try {
        if (settings().sound && typeof navigator.vibrate === 'function') {
            navigator.vibrate(pattern as number | number[]);
        }
    } catch {
        /* ignore */
    }
}

export const sfx = {
    correct(): void {
        note(659, 0, 0.16, 0.12);
        note(988, 0.1, 0.24, 0.1);
        haptic(20);
    },
    wrong(): void {
        note(311, 0, 0.2, 0.1);
        note(233, 0.11, 0.3, 0.08);
        haptic([30, 40, 30]);
    },
    /** Countdown beep for the final seconds — pitch rises as time runs out. */
    tick(secondsLeft: number): void {
        const freq = secondsLeft <= 1 ? 880 : secondsLeft === 2 ? 740 : 620;
        note(freq, 0, 0.09, 0.11);
    },
    finish(): void {
        [523, 659, 784, 1047].forEach((freq, i) => note(freq, i * 0.13, 0.3, 0.09));
    },
} as const;
