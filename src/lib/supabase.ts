import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for the shared, publicly-readable workout state. There is no
 * sign-in: the whole app reads one public row via the anon key (safe by design —
 * it ships in the browser bundle). Writes never go through this client directly;
 * Row-Level Security blocks them. The only write path is the `save_state` RPC,
 * which checks an edit password server-side (see lib/sync.ts).
 *
 * The SDK is loaded on first use, not at startup: it's the largest dependency
 * and the first screen renders from IndexedDB without it.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

let clientPromise: Promise<SupabaseClient | null> | null = null

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: {
        // No auth flow at all — don't touch the URL or persist a session.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  )
  return clientPromise
}
