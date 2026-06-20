import type { CSSProperties } from 'react'
import type { SetRow } from '@/db/types'
import { getSetRows } from '@/lib/format'

type Ex = { sets: number; weight: string; reps: string; setRows?: SetRow[] }

/** The actual values pop in a brighter color; the connecting words inherit the dim parent color. */
const value: CSSProperties = { color: 'var(--color-d9)' }

/** "225 lb × 4" with the weight + reps highlighted; the "×" stays dim. */
function Load({ weight, reps }: SetRow) {
  const w = weight.trim()
  const r = reps.replace(/^\s*[×x]\s*/i, '').trim() // strip any leading "×" so we add exactly one
  return (
    <>
      {w && <span style={value}>{w}</span>}
      {w && r && ' × '}
      {r && <span style={value}>{r}</span>}
    </>
  )
}

/**
 * The grey exercise summary, composed from the per-set values:
 *  • uniform sets  → "3 sets of 225 lb × 4"
 *  • mixed sets    → "225 lb × 4 · 205 lb × 6 · 205 lb × 6"
 * Values are highlighted; the connecting words stay in the parent's dim color.
 * Shared by the Library rows and the Home hero so they always read the same.
 */
export function ExerciseSummary({ ex }: { ex: Ex }) {
  const rows = getSetRows(ex)
  const first = rows[0]
  const uniform = rows.every(
    (r) => r.weight === first.weight && r.reps === first.reps,
  )

  if (uniform) {
    const hasLoad = Boolean(first.weight.trim() || first.reps.trim())
    return (
      <>
        <span style={value}>{rows.length}</span> {rows.length === 1 ? 'set' : 'sets'}
        {hasLoad && ' of '}
        {hasLoad && <Load weight={first.weight} reps={first.reps} />}
      </>
    )
  }

  // Mixed sets. If the reps are the same across sets (the usual back-off case),
  // show the reps once at the end: "335 lb · 275 lb · 225 lb × 4".
  const repsOf = (r: SetRow) => r.reps.replace(/^\s*[×x]\s*/i, '').trim()
  const sharedReps = repsOf(rows[0])
  const sameReps = sharedReps !== '' && rows.every((r) => repsOf(r) === sharedReps)

  if (sameReps) {
    return (
      <>
        {rows.map((r, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {r.weight.trim() && <span style={value}>{r.weight.trim()}</span>}
          </span>
        ))}
        {' × '}
        <span style={value}>{sharedReps}</span>
      </>
    )
  }

  // Reps differ too → spell out each set in full.
  return (
    <>
      {rows.map((r, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <Load weight={r.weight} reps={r.reps} />
        </span>
      ))}
    </>
  )
}
