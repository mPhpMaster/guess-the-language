import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearerToken, verifySession } from './_session.js';

const ALLOWED_REASONS: ReadonlySet<string> = new Set([
    'offensive_name',
    'impersonation',
    'spam_other',
]);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const session = verifySession(bearerToken(req.headers.authorization));
    if (!session) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const body = (req.body ?? {}) as {
        score_id?: unknown;
        reason?: unknown;
        details?: unknown;
    };
    const scoreId = Number(body.score_id);
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const details =
        String(typeof body.details === 'string' ? body.details : '')
            .trim()
            .slice(0, 250) || null;

    if (!Number.isSafeInteger(scoreId) || scoreId <= 0 || !ALLOWED_REASONS.has(reason)) {
        res.status(400).json({ error: 'Invalid report' });
        return;
    }

    const supabaseUrl = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!supabaseUrl || !serviceKey) {
        res.status(500).json({ error: 'Reporting is not configured' });
        return;
    }

    try {
        const result = await fetch(`${supabaseUrl}/rest/v1/leaderboard_reports`, {
            method: 'POST',
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                score_id: scoreId,
                reporter_discord_id: session.sub,
                reason,
                details,
            }),
        });
        if (result.status === 409) {
            res.status(409).json({ error: 'Already reported' });
            return;
        }
        if (!result.ok) {
            console.error('Report insert failed:', result.status, await result.text());
            res.status(502).json({ error: 'Could not save report' });
            return;
        }
        res.status(204).end();
    } catch (err) {
        console.error('Report endpoint error:', err);
        res.status(500).json({ error: 'Could not save report' });
    }
}
