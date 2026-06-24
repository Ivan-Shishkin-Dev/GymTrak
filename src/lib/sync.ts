import { useSyncExternalStore } from 'react'
import { db } from '@/db/db'
import { seedIfEmpty } from '@/db/seed'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Day, Exercise, Session, WorkoutSet } from '@/db/types'

/**
 * Public-read / password-write sync.
 *
 * The entire local database is mirrored to ONE shared, publicly-readable Supabase
 * row (`gt_state`, id = 1) as a JSON snapshot. Anyone can read it — that's how the
 * app is publicly viewable with no sign-in. Writing is gated by an edit password:
 *
 *   • Reads happen with the anon key (RLS allows `select` for everyone).
 *   • Writes go ONLY through the `save_state(password, data)` RPC, which verifies
 *     the password server-side. RLS blocks any direct table write, so the password
 *     is the real lock — the UI gating below is just UX.
 *
 * "Edit mode" = the user proved they're Ivan (entered the password). The password
 * is held in sessionStorage so it survives reloads in the same tab and rides along
 * on every save. Newest snapshot wins (last-write-wins by `updated_at`).
 */

type Snapshot = {
  days: Day[]
  exercises: Exercise[]
  sessions: Session[]
  sets: WorkoutSet[]
}

const TABLE = 'gt_state'
const ROW_ID = 1
const PW_KEY = 'gt_edit_pw'
const PUSH_DEBOUNCE_MS = 1200

/* ── Observable status for the UI ──────────────────────────────────────────── */

export type SyncStatus =
  | 'offline' // Supabase not configured
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'

export type SyncState = {
  configured: boolean
  status: SyncStatus
  editMode: boolean // true once the password is verified (Ivan)
  promptOpen: boolean // identity / password modal should be shown
  error: string | null
}

function readPw(): string | null {
  try {
    return sessionStorage.getItem(PW_KEY)
  } catch {
    return null
  }
}

let status: SyncStatus = isSupabaseConfigured ? 'idle' : 'offline'
let editMode = readPw() != null
let promptOpen = false
let lastError: string | null = null

const listeners = new Set<() => void>()
// Cached snapshot so useSyncExternalStore sees a stable reference between changes.
let snapshot: SyncState = {
  configured: isSupabaseConfigured,
  status,
  editMode,
  promptOpen,
  error: lastError,
}

function emit() {
  snapshot = {
    configured: isSupabaseConfigured,
    status,
    editMode,
    promptOpen,
    error: lastError,
  }
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

/** Hook: subscribe to the full sync state. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot)
}
/** Hook: just the edit-mode flag (screens use this to show/hide edit controls). */
export function useEditMode(): boolean {
  return useSyncExternalStore(subscribeSync, () => getSyncSnapshot().editMode)
}

/** Synchronous read for the action-layer write guard. */
export function isEditMode(): boolean {
  return editMode
}

/* ── Internal state ────────────────────────────────────────────────────────── */

let started = false
let suspended = false // true while we rewrite the DB from a pull (mutes change hooks)
let dirty = false // local edits not yet pushed
let cursor = 0 // updated_at of the snapshot currently reflected locally (in-memory)
let hasCloudRow = false
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

/** Push the whole local DB up via the password-checked RPC. No-ops unless in edit mode. */
async function push(): Promise<void> {
  const pw = readPw()
  if (!supabase || !editMode || !pw) return
  setStatus('syncing')
  const data = await serialize()
  const { data: ts, error } = await supabase.rpc('save_state', {
    p_password: pw,
    p_data: data,
  })
  if (error) {
    // Most likely the password is no longer valid → drop edit mode and re-prompt.
    if (/invalid password/i.test(error.message)) {
      clearPassword()
      setStatus('error', 'Edit code is no longer valid.')
      promptOpen = true
      emit()
    } else {
      setStatus('error', error.message)
    }
    return
  }
  cursor = Number(ts) || Date.now()
  hasCloudRow = true
  dirty = false
  setStatus('synced')
}

/** Adopt the server snapshot if it's newer than what we have locally. */
async function pull(): Promise<'pulled' | 'current' | 'empty'> {
  if (!supabase) return 'current'
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) {
    setStatus('error', error.message)
    return 'current'
  }
  if (!data) {
    hasCloudRow = false
    return 'empty'
  }
  hasCloudRow = true
  const serverUpdated = Number(data.updated_at)
  if (serverUpdated > cursor) {
    await applySnapshot(data.data as Snapshot)
    cursor = serverUpdated
    setStatus('synced')
    return 'pulled'
  }
  setStatus('synced')
  return 'current'
}

/** Pull only when we have no pending local edits — our push should win otherwise. */
async function pullIfIdle(): Promise<void> {
  if (dirty || pushTimer) return
  await pull()
}

function schedulePush(): void {
  if (!editMode) return
  setStatus('syncing')
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push()
  }, PUSH_DEBOUNCE_MS)
}

/**
 * First reconcile at startup. A fresh viewer must ADOPT the public cloud row, never
 * overwrite it. We only seed default data when no cloud row exists yet; otherwise
 * we adopt the cloud unless THIS device (in edit mode) has newer offline edits.
 */
async function reconcile(): Promise<void> {
  if (!supabase) return
  setStatus('syncing')
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) {
    setStatus('error', error.message)
    await seedIfEmpty()
    return
  }

  if (!data) {
    // No cloud row yet → seed locally so there's something to show. If we're the
    // editor, push it up to seed the public row for everyone else.
    hasCloudRow = false
    suspended = true
    try {
      await seedIfEmpty()
    } finally {
      suspended = false
    }
    if (editMode) await push()
    else setStatus('synced')
    return
  }

  hasCloudRow = true
  const serverUpdated = Number(data.updated_at)
  const localMax = await localMaxUpdatedAt()
  if (editMode && localMax > serverUpdated) {
    // This device has newer (offline) edits than the cloud → push them up.
    await push()
  } else {
    // Cloud is as-new-or-newer → adopt it wholesale (covers fresh viewers).
    await applySnapshot(data.data as Snapshot)
    cursor = serverUpdated
    dirty = false
    setStatus('synced')
  }
}

/* ── Change hooks (auto-push on any local write, only while editing) ────────── */

function onLocalChange(): void {
  if (suspended || !editMode) return
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
  if (!supabase || channel) return
  channel = supabase
    .channel('gt_state_sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      () => {
        void pullIfIdle()
      },
    )
    .subscribe()
}

/* ── Edit-mode (password) control ──────────────────────────────────────────── */

function clearPassword(): void {
  try {
    sessionStorage.removeItem(PW_KEY)
  } catch {
    /* ignore */
  }
  editMode = false
}

/** Verify the edit password; on success, enter edit mode for this session. */
export async function enterEditMode(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Editing is unavailable offline.' }
  const pw = password.trim()
  if (!pw) return { ok: false, error: 'Enter the code.' }
  const { data, error } = await supabase.rpc('check_password', { p_password: pw })
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Wrong code.' }

  try {
    sessionStorage.setItem(PW_KEY, pw)
  } catch {
    /* ignore */
  }
  editMode = true
  promptOpen = false
  emit()
  // First editor on an empty project: seed the public row so viewers see content.
  if (!hasCloudRow) await push()
  return { ok: true }
}

/** Leave edit mode (back to public view-only). Local data already matches cloud. */
export function exitEditMode(): void {
  clearPassword()
  emit()
}

/** Show / hide the identity (are-you-Ivan) modal. */
export function openEditPrompt(): void {
  promptOpen = true
  emit()
}
export function closeEditPrompt(): void {
  promptOpen = false
  emit()
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/** Wire up sync + seeding. Call once at startup (replaces the old seed call). */
export async function initSync(): Promise<void> {
  registerHooks()

  if (!supabase) {
    // No cloud configured → plain offline app (everything is locally editable).
    editMode = true
    setStatus('offline')
    await seedIfEmpty()
    return
  }

  if (started) return
  started = true

  window.addEventListener('online', () => {
    if (dirty && editMode) void push()
    else void pullIfIdle()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullIfIdle()
  })

  subscribeRealtime()
  await reconcile()
}
