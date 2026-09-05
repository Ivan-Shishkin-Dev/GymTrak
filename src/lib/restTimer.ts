import { useSyncExternalStore } from 'react'

/**
 * Rest timer — a tiny global store for the in-workout countdown.
 *
 * Rest is transient real-time UI, NOT training data, so it lives here rather than
 * in Dexie / the synced snapshot (a rest field would push timer noise to every
 * public viewer). It's a module-level observable — mirroring the sync store — so
 * the docked <RestBar> survives route changes: a rest started on /log stays
 * visible above the tab bar on Home.
 *
 * The countdown is timestamp-based (`startedAt` + `targetSec`): remaining is
 * computed from `Date.now()` on each render, so a throttled background tab still
 * resolves to the correct value. Components own the ticking; this store only
 * changes on a user action.
 */

const DEFAULT_KEY = 'gt_rest_default'
const ACTIVE_KEY = 'gt_rest_active'
const FALLBACK_SEC = 180 // 3 min
const MIN_SEC = 15
const MAX_SEC = 600

export type RestState = {
  active: boolean
  startedAt: number // epoch ms this rest began
  targetSec: number // current target length (drives the ring fraction)
  defaultSec: number // persisted default for the next rest
}

function clampSec(s: number): number {
  return Math.max(MIN_SEC, Math.min(MAX_SEC, Math.round(s)))
}

function readDefault(): number {
  try {
    const raw = localStorage.getItem(DEFAULT_KEY)
    const n = raw == null ? NaN : Number(raw)
    return Number.isFinite(n) ? clampSec(n) : FALLBACK_SEC
  } catch {
    return FALLBACK_SEC
  }
}

// One cached object so useSyncExternalStore sees a stable reference between emits.
function readActive(): Pick<RestState, 'active' | 'startedAt' | 'targetSec'> {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as {
      startedAt?: number
      targetSec?: number
    } | null
    if (!parsed?.startedAt || !parsed.targetSec) return { active: false, startedAt: 0, targetSec: readDefault() }
    const age = Date.now() - parsed.startedAt
    if (age < 0 || age > (parsed.targetSec + 300) * 1000) {
      localStorage.removeItem(ACTIVE_KEY)
      return { active: false, startedAt: 0, targetSec: readDefault() }
    }
    return { active: true, startedAt: parsed.startedAt, targetSec: parsed.targetSec }
  } catch {
    return { active: false, startedAt: 0, targetSec: readDefault() }
  }
}

const restored = readActive()
let state: RestState = { ...restored, defaultSec: readDefault() }

const listeners = new Set<() => void>()
function emit(next: Partial<RestState>): void {
  state = { ...state, ...next }
  try {
    if (state.active) {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({ startedAt: state.startedAt, targetSec: state.targetSec }))
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch {
    /* storage may be unavailable; the live timer still works */
  }
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot(): RestState {
  return state
}

/** Hook: subscribe to the rest-timer state. */
export function useRestTimer(): RestState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** Seconds left for a given clock reading; negative once in overrun. */
export function remainingSec(s: RestState, now: number): number {
  return s.targetSec - (now - s.startedAt) / 1000
}

/** Start (or restart) a rest at the current default. Called when a set is ticked done. */
export function startRest(seconds?: number): void {
  emit({ active: true, startedAt: Date.now(), targetSec: clampSec(seconds ?? state.defaultSec) })
}

/** Nudge THIS rest only (±15s); not persisted. */
export function addTime(delta: number): void {
  if (!state.active) return
  emit({ targetSec: clampSec(state.targetSec + delta) })
}

/** Set the default for future rests (persisted) and retarget the running rest now. */
export function setDefault(sec: number): void {
  const v = clampSec(sec)
  try {
    localStorage.setItem(DEFAULT_KEY, String(v))
  } catch {
    /* ignore */
  }
  emit(
    state.active
      ? { defaultSec: v, startedAt: Date.now(), targetSec: v }
      : { defaultSec: v },
  )
}

/** Stop resting (Skip / Finish / overrun auto-stop). */
export function stopRest(): void {
  if (state.active) emit({ active: false })
}
