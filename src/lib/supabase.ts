import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for optional cloud sync. The app is fully usable offline
 * without it — if the env vars are missing, `supabase` is null and every sync
 * call no-ops, so nothing breaks. The key here is the *publishable* key, which
 * is public by design (it ships in the browser bundle); per-user data is guarded
 * by Row-Level Security on the server, not by hiding this key.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
