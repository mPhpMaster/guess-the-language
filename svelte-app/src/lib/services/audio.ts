import { settings } from '$lib/state/settings.svelte';

/**
 * WebAudio sound effects — synthesized, so the bundle ships no audio assets.
 * The context is created lazily on first use because browsers refuse to start
 * one before a user gesture.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function ensureAudio(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  if (!settings.sound) return;
  try {
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;
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
  } catch {
    /* audio not available — never let a sound break the round */
  }
}

/**
 * Light haptic buzz on mobile, gated by the same "sound effects" preference so
 * one toggle silences both. No-op where the Vibration API is unavailable.
 */
export function haptic(pattern: number | number[]): void {
  try {
    if (settings.sound && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  /** Soft rising chime. */
  correct(): void {
    note(659, 0, 0.16, 0.12);
    note(988, 0.1, 0.24, 0.1);
    haptic(20);
  },
  /** Soft descending pair. */
  wrong(): void {
    note(311, 0, 0.2, 0.1);
    note(233, 0.11, 0.3, 0.08);
    haptic([30, 40, 30]);
  },
  /** Countdown beep for the final seconds — pitch rises as time runs out. */
  tick(secondsLeft: number): void {
    const f = secondsLeft <= 1 ? 880 : secondsLeft === 2 ? 740 : 620;
    note(f, 0, 0.09, 0.11);
  },
  /** Gentle arpeggio at the end of a round. */
  finish(): void {
    [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.3, 0.09));
  }
};
