import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearerToken, verifySession } from './_session.js';

/* ============================================================
   Admin API — every destructive capability the in-game admin
   panel exposes goes through here.

   Security model:
     1. The caller must present a session token whose signed `adm` claim is true.
        That claim is set server-side in /api/token from the real Discord
        username, and the token is HMAC-signed, so it cannot be self-granted.
     2. Actual DB writes use the Supabase SERVICE ROLE key (never shipped to the
        client) through service_role-only RPCs, which anon cannot reach.
   ============================================================ */

interface SupabaseConfig {
    readonly url: string;
    readonly key: string;
}

class SupabaseError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'SupabaseError';
    }
}

function supabaseConfig(): SupabaseConfig | null {
    const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    return url && key ? { url, key } : null;
}

async function sb<T>(
    config: SupabaseConfig,
    path: string,
    init: RequestInit = {},
): Promise<T | null> {
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const message =
            typeof body === 'object' && body !== null && 'message' in body
                ? String((body as { message: unknown }).message)
                : `Supabase ${res.status}`;
        throw new SupabaseError(message, res.status);
    }
    return body as T | null;
}

/** Call a service_role-only RPC. */
function rpc(
    config: SupabaseConfig,
    fn: string,
    args: Readonly<Record<string, unknown>>,
): Promise<unknown> {
    return sb<unknown>(config, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

interface ReportRow {
    readonly id: number;
    readonly score_id: number;
    readonly reason: string;
    readonly details: string | null;
    readonly status: string | null;
}

interface ScoreRow {
    readonly id: number;
    readonly player: string;
    readonly score: number;
    readonly mode: string;
}

interface StatsRow {
    readonly player: string;
}

const LIVE_WINDOW_MS = 3 * 60 * 1000;

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
    if (session.adm !== true) {
        res.status(403).json({ error: 'Not an admin' });
        return;
    }

    const config = supabaseConfig();
    if (!config) {
        res.status(500).json({ error: 'Admin API is not configured' });
        return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body['action'] ?? '');
    const by = String(session.uname ?? session.sub);

    const readId = (): number | null => {
        const id = Number(body['id']);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    };
    const readPlayer = (): string => String(body['player'] ?? '').trim();

    try {
        switch (action) {
            case 'whoami': {
                res.status(200).json({
                    admin: true,
                    sub: session.sub,
                    username: session.uname ?? null,
                });
                return;
            }

            case 'reports': {
                // Open reports first, then recently resolved; attach the reported score.
                const reports =
                    (await sb<readonly ReportRow[]>(
                        config,
                        'leaderboard_reports?select=id,score_id,reporter_discord_id,reason,details,' +
                            'status,created_at,resolved_at,resolved_by&order=status.asc,created_at.desc&limit=100',
                    )) ?? [];
                const ids = [...new Set(reports.map((row) => row.score_id).filter(Boolean))];
                const scores = ids.length
                    ? ((await sb<readonly ScoreRow[]>(
                          config,
                          `scores?select=id,player,score,mode,avatar,multiplayer&id=in.(${ids.join(',')})`,
                      )) ?? [])
                    : [];
                const byId = new Map(scores.map((score) => [score.id, score]));
                res.status(200).json({
                    reports: reports.map((row) => ({
                        ...row,
                        score: byId.get(row.score_id) ?? null,
                    })),
                });
                return;
            }

            case 'resolve_report': {
                const id = readId();
                if (id === null) {
                    res.status(400).json({ error: 'Bad id' });
                    return;
                }
                const status = body['status'] === 'dismissed' ? 'dismissed' : 'resolved';
                await sb<null>(config, `leaderboard_reports?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: { Prefer: 'return=minimal' },
                    body: JSON.stringify({
                        status,
                        resolved_at: new Date().toISOString(),
                        resolved_by: by,
                    }),
                });
                res.status(200).json({ ok: true });
                return;
            }

            case 'delete_score': {
                const id = readId();
                if (id === null) {
                    res.status(400).json({ error: 'Bad id' });
                    return;
                }
                await rpc(config, 'admin_delete_score', { p_id: id, p_by: by });
                res.status(200).json({ ok: true });
                return;
            }

            case 'ban': {
                const player = readPlayer();
                if (!player) {
                    res.status(400).json({ error: 'Bad player' });
                    return;
                }
                await rpc(config, 'admin_ban', {
                    p_player: player,
                    p_reason: String(body['reason'] ?? '').trim().slice(0, 200),
                    p_by: by,
                });
                res.status(200).json({ ok: true });
                return;
            }

            case 'unban': {
                const player = readPlayer();
                if (!player) {
                    res.status(400).json({ error: 'Bad player' });
                    return;
                }
                await rpc(config, 'admin_unban', { p_player: player });
                res.status(200).json({ ok: true });
                return;
            }

            case 'reset_profile': {
                const player = readPlayer();
                if (!player) {
                    res.status(400).json({ error: 'Bad player' });
                    return;
                }
                await rpc(config, 'admin_reset_profile', { p_player: player });
                res.status(200).json({ ok: true });
                return;
            }

            case 'banned': {
                const rows = await sb<readonly unknown[]>(
                    config,
                    'banned_players?select=player,reason,banned_by,created_at&order=created_at.desc&limit=200',
                );
                res.status(200).json({ banned: rows ?? [] });
                return;
            }

            case 'users': {
                const search = String(body['search'] ?? '').trim();
                const filter = search ? `&player=ilike.*${encodeURIComponent(search)}*` : '';
                const rows =
                    (await sb<readonly StatsRow[]>(
                        config,
                        'player_stats?select=player,level,xp,games,mp_games,wins,day_streak,perfect_games,' +
                            `last_seen&order=last_seen.desc.nullslast&limit=200${filter}`,
                    )) ?? [];
                const banned =
                    (await sb<readonly { player: string }[]>(
                        config,
                        'banned_players?select=player',
                    )) ?? [];
                const bannedSet = new Set(banned.map((row) => row.player));
                res.status(200).json({
                    users: rows.map((row) => ({
                        ...row,
                        banned: bannedSet.has(row.player.trim().toLowerCase()),
                    })),
                });
                return;
            }

            case 'live': {
                const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
                const rows = await sb<readonly unknown[]>(
                    config,
                    'presence?select=player,discord_id,guild_id,channel_id,mode,activity,platform,' +
                        `updated_at&updated_at=gte.${since}&order=updated_at.desc&limit=200`,
                );
                res.status(200).json({ live: rows ?? [] });
                return;
            }

            default: {
                res.status(400).json({ error: 'Unknown action' });
                return;
            }
        }
    } catch (err) {
        console.error('admin action failed:', action, err);
        const status = err instanceof SupabaseError && err.status < 500 ? err.status : 500;
        res.status(status).json({ error: 'Admin action failed' });
    }
}
