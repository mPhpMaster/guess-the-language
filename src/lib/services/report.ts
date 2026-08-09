import { apiPrefix, appSessionToken, discordProfile } from './discord.svelte';
import { supabaseConfigured } from './supabase';

/**
 * Reporting a leaderboard entry.
 *
 * The write goes through `/api/report` rather than straight to PostgREST: the
 * reporter's identity is taken from the signed session token server-side, so a
 * client cannot file a report as somebody else, and `leaderboard_reports` stays
 * closed to anon.
 */

export const REPORT_REASONS = ['offensive_name', 'impersonation', 'spam_other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportOutcome = 'ok' | 'duplicate' | 'failed';

/** True when reporting can work at all — it needs an identity and a backend. */
export function reportingAvailable(): boolean {
  return !!appSessionToken() && !!discordProfile()?.id && supabaseConfigured();
}

export async function submitReport(input: {
  scoreId: number;
  reason: ReportReason;
  details?: string;
}): Promise<ReportOutcome> {
  const token = appSessionToken();
  if (!token || !input.scoreId || !REPORT_REASONS.includes(input.reason)) return 'failed';

  try {
    const res = await fetch(`${apiPrefix()}/api/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score_id: input.scoreId,
        reason: input.reason,
        details: input.details?.trim().slice(0, 250) || null
      })
    });
    if (res.ok) return 'ok';
    // A unique index turns a second report of the same entry into a 409, which
    // deserves its own message rather than looking like a failure.
    if (res.status === 409) return 'duplicate';
    console.error('report failed:', res.status, await res.text().catch(() => ''));
    return 'failed';
  } catch (err) {
    console.error('report failed:', err);
    return 'failed';
  }
}
