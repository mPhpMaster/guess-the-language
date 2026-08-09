import { apiPrefix, appSessionToken } from './discord.svelte';

/**
 * Admin client.
 *
 * The UI gate below reads the session token's claims WITHOUT verifying them —
 * a forged token would reveal the admin button and nothing more. Real
 * enforcement is entirely server-side: `/api/admin` verifies the HMAC signature
 * and the admin claim, and the underlying RPCs are granted to `service_role`
 * only. Never move an authorization decision into this file.
 */

export type AdminTab = 'reports' | 'users' | 'live' | 'bans';

export interface AdminReport {
  id: number;
  score_id: number | null;
  reporter: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
  player?: string | null;
  score?: number | null;
  mode?: string | null;
}

export interface AdminUser {
  player: string;
  games?: number;
  xp?: number;
  level?: number;
  last_seen?: string | null;
  banned?: boolean;
}

export interface AdminLiveRow {
  player: string;
  activity: string | null;
  platform: string | null;
  mode: string | null;
  guild_id: string | null;
  updated_at: string;
}

export interface AdminBan {
  player: string;
  reason: string | null;
  banned_by: string | null;
  created_at: string;
}

function b64urlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

interface SessionClaims {
  /** Admin flag, set server-side when the Discord username matches. */
  adm?: boolean;
  uname?: string | null;
  /** Unix seconds. Sessions last a week; the server rejects them after that. */
  exp?: number;
}

/**
 * Claims from the stored session token, or null when there is no usable one.
 *
 * Expiry is checked here as well as on the server. It has to be: the token is
 * only minted at sign-in and is never refreshed, so after a week the server
 * starts returning 401 — and without this check the admin button stayed visible
 * and every action failed with "Authentication required" instead of the app
 * simply asking the user to sign in again.
 */
export function sessionClaims(): SessionClaims | null {
  try {
    const token = appSessionToken();
    if (!token) return null;
    const claims = JSON.parse(b64urlDecode(token.split('.')[0] ?? '')) as SessionClaims;
    if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** True when a session exists but has aged out — the caller should re-authenticate. */
export function sessionExpired(): boolean {
  return !!appSessionToken() && !sessionClaims();
}

/** UI-only hint. See the note at the top of this file. */
export function isAdmin(): boolean {
  return !!sessionClaims()?.adm;
}

async function adminApi<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const token = appSessionToken();
  if (!token) throw new Error('Sign in with Discord first.');
  // Fail with something actionable rather than letting the server answer 401
  // with "Authentication required", which reads like a bug rather than a
  // week-old session.
  if (!sessionClaims()) throw new Error('Your session expired — sign out and sign in again.');
  const res = await fetch(`${apiPrefix()}/api/admin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra })
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `admin ${res.status}`);
  return data as T;
}

export const admin = {
  reports: () => adminApi<AdminReport[]>('reports'),
  users: (search = '') => adminApi<AdminUser[]>('users', { search }),
  live: () => adminApi<AdminLiveRow[]>('live'),
  banned: () => adminApi<AdminBan[]>('banned'),

  resolveReport: (id: number, status: 'resolved' | 'dismissed') =>
    adminApi<unknown>('resolve_report', { id, status }),
  deleteScore: (id: number) => adminApi<unknown>('delete_score', { id }),
  ban: (player: string, reason = '') => adminApi<unknown>('ban', { player, reason }),
  unban: (player: string) => adminApi<unknown>('unban', { player }),
  resetProfile: (player: string) => adminApi<unknown>('reset_profile', { player })
};
