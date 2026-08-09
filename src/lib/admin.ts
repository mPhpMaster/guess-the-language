import { apiPrefix } from './platform';
import { appSessionToken } from './identity';
import type { AdminBan, AdminLiveEntry, AdminReport, AdminUser } from '../types/models';

/* ============================================================
   Admin API client. Every action is verified server-side against
   the signed `adm` claim — this is only the transport.
   ============================================================ */

export type AdminAction =
    | 'whoami'
    | 'reports'
    | 'resolve_report'
    | 'delete_score'
    | 'ban'
    | 'unban'
    | 'reset_profile'
    | 'banned'
    | 'users'
    | 'live';

interface AdminEnvelope {
    readonly reports?: readonly AdminReport[];
    readonly users?: readonly AdminUser[];
    readonly live?: readonly AdminLiveEntry[];
    readonly banned?: readonly AdminBan[];
    readonly error?: string;
}

export async function adminApi(
    action: AdminAction,
    extra: Readonly<Record<string, unknown>> = {},
): Promise<AdminEnvelope> {
    const token = appSessionToken();
    if (!token) throw new Error('no session');
    const res = await fetch(`${apiPrefix()}/api/admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as AdminEnvelope) : {};
    if (!res.ok) throw new Error(data.error ?? `admin ${res.status}`);
    return data;
}

export function adminReports(): Promise<readonly AdminReport[]> {
    return adminApi('reports').then((data) => data.reports ?? []);
}

export function adminUsers(search: string): Promise<readonly AdminUser[]> {
    return adminApi('users', { search }).then((data) => data.users ?? []);
}

export function adminLive(): Promise<readonly AdminLiveEntry[]> {
    return adminApi('live').then((data) => data.live ?? []);
}

export function adminBanned(): Promise<readonly AdminBan[]> {
    return adminApi('banned').then((data) => data.banned ?? []);
}

/** Compact "how long ago" label, e.g. `12m`. */
export function timeAgo(iso: string | null): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86_400)}d`;
}
