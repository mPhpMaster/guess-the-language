import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* ============================================================
   Supabase access — a thin typed REST helper plus the realtime
   client used by multiplayer.
   ============================================================ */

export function supabaseConfig(): SupabaseRuntimeConfig | null {
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config.anonKey) return null;
    return config;
}

export function supabaseConfigured(): boolean {
    return supabaseConfig() !== null;
}

let client: SupabaseClient | null = null;

export function supabaseClient(): SupabaseClient {
    const config = supabaseConfig();
    if (!config) throw new Error('Supabase not configured');
    client ??= createClient(config.url, config.anonKey);
    return client;
}

export interface SbFetchOptions {
    readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD';
    readonly body?: string;
    readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Call PostgREST and parse the JSON body. Tolerates empty bodies:
 * `return=minimal` inserts answer 201/204 with no content.
 */
export async function sbFetch<T>(pathQuery: string, options: SbFetchOptions = {}): Promise<T | null> {
    const config = supabaseConfig();
    if (!config) throw new Error('Supabase not configured');

    const init: RequestInit = {
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    };
    if (options.method) init.method = options.method;
    if (options.body !== undefined) init.body = options.body;

    const res = await fetch(`${config.url}/rest/v1/${pathQuery}`, init);
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
}

/** `count=exact` HEAD request — returns the total row count, or null. */
export async function sbCount(pathQuery: string): Promise<number | null> {
    const config = supabaseConfig();
    if (!config) return null;
    const res = await fetch(`${config.url}/rest/v1/${pathQuery}`, {
        method: 'HEAD',
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            Prefer: 'count=exact',
        },
    });
    if (!res.ok) return null;
    const total = Number((res.headers.get('content-range') ?? '').split('/')[1]);
    return Number.isFinite(total) ? total : null;
}

export function sbRows<T>(value: readonly T[] | null): readonly T[] {
    return value ?? [];
}
