<script lang="ts">
  import { RING_CIRCUMFERENCE } from '$lib/game/constants';

  interface Props {
    /** 1 → 0 as time runs out. */
    fraction: number;
    /** Seconds remaining, or null for practice mode's ∞. */
    seconds: number | null;
  }

  let { fraction, seconds }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(1, fraction)));
  const offset = $derived(RING_CIRCUMFERENCE * (1 - clamped));
</script>

<div class="timer-ring" role="timer" aria-label="Time remaining">
  <svg viewBox="0 0 120 120">
    <circle class="ring-bg" cx="60" cy="60" r="52" />
    <circle
      class="ring-fg"
      cx="60"
      cy="60"
      r="52"
      style:stroke-dasharray={RING_CIRCUMFERENCE}
      style:stroke-dashoffset={offset}
    />
  </svg>
  <div class="timer-num" dir="ltr">{seconds === null ? '∞' : seconds}</div>
</div>
