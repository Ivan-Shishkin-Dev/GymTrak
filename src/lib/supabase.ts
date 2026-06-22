import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the shared, publicly-readable workout state. There is no
 * sign-in: the whole app reads one public row via the anon key (safe by design —
 * it ships in the browser bundle). Writes never go through this client directly;
 * Row-Level Security blocks them. The only write path is the `save_state` RPC,
 * which checks an edit password server-side (see lib/sync.ts).
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // No auth flow at all — don't touch the URL or persist a session.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null
