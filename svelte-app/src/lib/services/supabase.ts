/**
 * Thin PostgREST client.
 *
 * Deliberately not `@supabase/supabase-js`: the app only ever issues REST reads,
 * inserts and RPC calls with the anon key, and the full SDK would add far more
 * to the bundle than these thirty lines. Config is injected at runtime (see
 * `public/supabase-config.js`) so the same build works across deployments.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

declare global {
  interface Window {
    SUPABASE_CONFIG?: Partial<SupabaseConfig>;
  }
}

export function supabaseConfig(): SupabaseConfig | null {
  const c = window.SUPABASE_CONFIG;
  return c?.url && c.anonKey ? { url: c.url, anonKey: c.anonKey } : null;
}

export function supabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

export class SupabaseError extends Error {
  constructor(
    readonly status: number,
    body: string
  ) {
    super(`Supabase ${status}: ${body}`);
    this.name = 'SupabaseError';
  }
}

export async function sbFetch<T = unknown>(pathQuery: string, options: RequestInit = {}): Promise<T | null> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase is not configured');

  const res = await fetch(`${cfg.url}/rest/v1/${pathQuery}`, {
    ...options,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });

  if (!res.ok) throw new SupabaseError(res.status, await res.text());

  // Tolerate empty bodies: `return=minimal` inserts come back 201/204 with no
  // body, so parsing unconditionally would throw "Unexpected end of JSON input".
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  return sbFetch<T>(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

export function insert(table: string, rows: unknown[]): Promise<unknown> {
  return sbFetch(table, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows)
  });
}
