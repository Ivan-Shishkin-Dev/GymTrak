import { db } from '@/db/db'
import { seedIfEmpty } from '@/db/seed'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Day, Exercise, Session, WorkoutSet } from '@/db/types'

/**
 * Whole-DB blob sync (see README). The entire local database is shipped to one
 * Supabase row (`gt_state`) as JSON; the newest snapshot wins (last-write-wins by
 * `updated_at`). Because we snapshot everything, deletions and per-set edits sync
 * for free — a removed record is simply absent from the next snapshot, no
 * tombstones needed. This is plenty for a single user who edits one device at a
 * time; truly simultaneous edits on two devices resolve to whichever saved last.
 *
 * The app stays fully usable offline and signed-out — every function below
 * no-ops when Supabase isn't configured or no one is signed in.
 */

type Snapshot = {
  days: Day[]
  exercises: Exercise[]
  sessions: Session[]
  sets: WorkoutSet[]
}

const TABLE = 'gt_state'
const PUSH_DEBOUNCE_MS = 1200

/* ── Observable status for the UI ──────────────────────────────────────────── */

export type SyncStatus =
  | 'offline' // Supabase not configured
  | 'signed-out'
  | 'syncing'
  | 'synced'
  | 'error'

export type SyncState = {
  configured: boolean
  status: SyncStatus
  email: string | null
  error: string | null
}

let status: SyncStatus = isSupabaseConfigured ? 'signed-out' : 'offline'
let email: string | null = null
let lastError: string | null = null

const listeners = new Set<() => void>()
// Cached snapshot so useSyncExternalStore sees a stable reference between changes.
let snapshot: SyncState = {
  configured: isSupabaseConfigured,
  status,
  email,
  error: lastError,
}

function emit() {
  snapshot = { configured: isSupabaseConfigured, status, email, error: lastError }
  for (const l of listeners) l()
}
function setStatus(s: SyncStatus, err: string | null = null) {
  status = s
  lastError = err
  emit()
}

export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function getSyncSnapshot(): SyncState {
  return snapshot
}

/* ── Internal state ────────────────────────────────────────────────────────── */

let userId: string | null = null
let started = false
let suspended = false // true while we rewrite the DB from a pull (mutes change hooks)
let dirty = false // local edits not yet pushed
let cursor = 0 // updated_at of the snapshot currently reflected locally (in-memory)
let pushTimer: ReturnType<typeof setTimeout> | null = null
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

/* ── Snapshot serialize / apply ────────────────────────────────────────────── */

async function serialize(): Promise<Snapshot> {
  const [days, exercises, sessions, sets] = await Promise.all([
    db.days.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
  ])
  return { days, exercises, sessions, sets }
}

/** Replace the entire local DB with a snapshot. Mutes change hooks while it runs. */
async function applySnapshot(s: Snapshot): Promise<void> {
  suspended = true
  try {
    await db.transaction(
      'rw',
      [db.days, db.exercises, db.sessions, db.sets],
      async () => {
        await Promise.all([
          db.days.clear(),
          db.exercises.clear(),
          db.sessions.clear(),
          db.sets.clear(),
        ])
        await Promise.all([
          db.days.bulkAdd(s.days ?? []),
          db.exercises.bulkAdd(s.exercises ?? []),
          db.sessions.bulkAdd(s.sessions ?? []),
          db.sets.bulkAdd(s.sets ?? []),
        ])
      },
    )
  } finally {
    suspended = false
  }
}

/** Newest `updatedAt` across all local records (0 if empty). Drives push-vs-pull. */
async function localMaxUpdatedAt(): Promise<number> {
  const s = await serialize()
  let m = 0
  for (const arr of [s.exercises, s.sessions, s.sets]) {
    for (const r of arr) {
      if (typeof r.updatedAt === 'number' && r.updatedAt > m) m = r.updatedAt
    }
  }
  return m
}

/* ── Push / pull ───────────────────────────────────────────────────────────── */

async function push(): Promise<void> {
  if (!supabase || !userId) return
  setStatus('syncing')
  const data = await serialize()
  const updated_at = Date.now()
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data, updated_at }, { onConflict: 'user_id' })
  if (error) {
    setStatus('error', error.message)
    return
  }
  cursor = updated_at
  dirty = false
  setStatus('synced')
}

/** Adopt the server snapshot if it's newer than what we have locally. */
async function pull(): Promise<'pulled' | 'current' | 'empty'> {
  if (!supabase || !userId) return 'current'
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    setStatus('error', error.message)
    return 'current'
  }
  if (!data) return 'empty'
  const serverUpdated = Number(data.updated_at)
  if (serverUpdated > cursor) {
    await applySnapshot(data.data as Snapshot)
    cursor = serverUpdated
    setStatus('synced')
    return 'pulled'
  }
  return 'current'
}

/** Pull only when we have no pending local edits — our push should win otherwise. */
async function pullIfIdle(): Promise<void> {
  if (dirty || pushTimer || !userId) return
  await pull()
}

function schedulePush(): void {
  setStatus('syncing')
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push()
  }, PUSH_DEBOUNCE_MS)
}

/**
 * First reconcile after sign-in. The careful bit: a fresh device must ADOPT the
 * cloud, never overwrite it with default seed data — so we only seed when the
 * cloud row doesn't exist yet, and otherwise compare timestamps to decide which
 * side is newer.
 */
async function reconcile(): Promise<void> {
  if (!supabase || !userId) return
  setStatus('syncing')
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    setStatus('error', error.message)
    return
  }

  if (!data) {
    // No cloud row yet → this device seeds the cloud. Seed locally first if empty.
    suspended = true
    try {
      await seedIfEmpty()
    } finally {
      suspended = false
    }
    await push()
    return
  }

  const serverUpdated = Number(data.updated_at)
  const localMax = await localMaxUpdatedAt()
  if (localMax > serverUpdated) {
    // Local has newer (offline) edits than the cloud → push them up.
    await push()
  } else {
    // Cloud is as-new-or-newer → adopt it wholesale (covers fresh/empty devices).
    await applySnapshot(data.data as Snapshot)
    cursor = serverUpdated
    dirty = false
    setStatus('synced')
  }
}

/* ── Change hooks (auto-push on any local write) ───────────────────────────── */

function onLocalChange(): void {
  if (suspended || !userId) return
  dirty = true
  schedulePush()
}

let hooksRegistered = false
function registerHooks(): void {
  if (hooksRegistered) return
  hooksRegistered = true
  const tables = [db.days, db.exercises, db.sessions, db.sets]
  for (const t of tables) {
    t.hook('creating', () => onLocalChange())
    t.hook('updating', () => onLocalChange())
    t.hook('deleting', () => onLocalChange())
  }
}

/* ── Realtime ──────────────────────────────────────────────────────────────── */

function subscribeRealtime(): void {
  if (!supabase || !userId) return
  channel = supabase
    .channel('gt_state_sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void pullIfIdle()
      },
    )
    .subscribe()
}
function teardownRealtime(): void {
  if (channel && supabase) {
    void supabase.removeChannel(channel)
    channel = null
  }
}

/* ── Auth lifecycle ────────────────────────────────────────────────────────── */

async function handleAuth(uid: string | null, mail: string | null): Promise<void> {
  email = mail
  if (started && uid === userId) {
    emit() // token refresh / no identity change
    return
  }
  started = true
  userId = uid
  teardownRealtime()
  if (userId) {
    cursor = 0
    dirty = false
    setStatus('syncing')
    subscribeRealtime()
    await reconcile()
  } else {
    setStatus('signed-out')
    // Local-only mode: seed the split if this is a blank install.
    await seedIfEmpty()
  }
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/** Wire up sync + seeding. Call once at startup (replaces the old seed call). */
export async function initSync(): Promise<void> {
  registerHooks()

  if (!supabase) {
    // No cloud configured → plain offline app.
    setStatus('offline')
    await seedIfEmpty()
    return
  }

  window.addEventListener('online', () => void pullIfIdle())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullIfIdle()
  })

  // onAuthStateChange fires INITIAL_SESSION on load, so it drives first reconcile.
  supabase.auth.onAuthStateChange((_event, session) => {
    void handleAuth(session?.user?.id ?? null, session?.user?.email ?? null)
  })
}

/** Send a magic-link sign-in email. */
export async function signInWithEmail(
  address: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Cloud sync is not configured.' }
  const { error } = await supabase.auth.signInWithOtp({
    email: address.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

/** Force an immediate two-way reconcile (manual "Sync now"). */
export async function syncNow(): Promise<void> {
  if (!userId) return
  if (dirty || pushTimer) {
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
    await push()
  } else {
    await pull()
  }
}
