import type { ReactNode } from 'react'
import type { Exercise, WorkoutSet } from '@/db/types'

/** Reps are stored as "× 6"; this returns the bare "6". */
export const bareReps = (reps: string) => reps.replace(/^\s*[×x]\s*/i, '').trim()

export type NextUp = { name: string; setNumber: number; weight: string; reps: string; sameExercise: boolean }

/**
 * Set-by-set view for a live workout: the one set to do now, large, with
 * steppers for load and reps. The "Done set" button lives in Log's footer so it
 * sits in thumb reach. Set chips show progress through this exercise; tapping a
 * finished chip unticks it (the undo path).
 */
export function FocusSet({
  ex,
  sets,
  current,
  canEdit,
  canStep,
  weightEditor,
  repsEditor,
  next,
  onStepLoad,
  onStepReps,
  onEditWeight,
  onEditReps,
  onChip,
}: {
  ex: Exercise
  sets: WorkoutSet[]
  current: WorkoutSet
  canEdit: boolean
  canStep: boolean
  weightEditor: ReactNode | null
  repsEditor: ReactNode | null
  next: NextUp | null
  onStepLoad: (direction: -1 | 1) => void
  onStepReps: (direction: -1 | 1) => void
  onEditWeight: () => void
  onEditReps: () => void
  onChip: (set: WorkoutSet) => void
}) {
  const index = sets.findIndex((s) => s.id === current.id)
  const reps = bareReps(current.reps)
  const repsNumeric = /^\d+$/.test(reps)

  return (
    <div className="card" style={{ borderRadius: 20, padding: '20px 18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>{ex.name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.1em', color: 'var(--color-volt)' }}>
          SET {index + 1} OF {sets.length}
        </div>
      </div>

      {/* set chips — progress through this exercise; a done chip can be unticked */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Sets for this exercise">
        {sets.map((s, i) => {
          const done = s.completedAt != null
          const isCurrent = s.id === current.id
          return (
            <button
              key={s.id}
              className={done && canEdit ? 'tap press' : undefined}
              disabled={!done || !canEdit}
              onClick={() => onChip(s)}
              aria-label={`Set ${i + 1}: ${s.weight || 'no load'} × ${bareReps(s.reps)}${done ? ', done. Tap to untick' : isCurrent ? ', current' : ''}`}
              style={{
                minWidth: 64,
                height: 44,
                padding: '0 10px',
                borderRadius: 12,
                border: `1.5px solid ${done || isCurrent ? 'var(--color-volt)' : 'var(--color-pill-border)'}`,
                background: done ? 'var(--color-volt-tint)' : 'transparent',
                color: done ? 'var(--color-volt)' : isCurrent ? 'var(--color-text)' : 'var(--color-faint)',
                fontSize: 12.5,
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: done && canEdit ? 'pointer' : 'default',
                opacity: 1,
              }}
            >
              {done && <span aria-hidden="true">✓</span>}
              <span className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>{s.weight || '—'} × {bareReps(s.reps)}</span>
            </button>
          )
        })}
      </div>

      <Stepper
        label="Load"
        canStep={canStep}
        decLabel={`Decrease ${ex.name} load`}
        incLabel={`Increase ${ex.name} load`}
        onStep={onStepLoad}
      >
        {weightEditor ?? (
          <button
            className={canEdit ? 'tap' : undefined}
            onClick={canEdit ? onEditWeight : undefined}
            aria-label={`Load ${current.weight || 'not set'}. ${canEdit ? 'Tap to type a value' : ''}`}
            style={valueButton}
          >
            <span className="display tabular-nums" style={{ fontSize: current.weight.length > 7 ? 32 : 44, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
              {current.weight || '—'}
            </span>
          </button>
        )}
      </Stepper>

      <Stepper
        label="Reps"
        canStep={canEdit && repsNumeric}
        decLabel={`Decrease ${ex.name} reps`}
        incLabel={`Increase ${ex.name} reps`}
        onStep={onStepReps}
      >
        {repsEditor ?? (
          <button
            className={canEdit ? 'tap' : undefined}
            onClick={canEdit ? onEditReps : undefined}
            aria-label={`${reps} reps. ${canEdit ? 'Tap to type a value' : ''}`}
            style={valueButton}
          >
            <span className="display tabular-nums" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{reps || '—'}</span>
            <span style={{ fontSize: 14, color: 'var(--color-sub)', fontWeight: 600, marginLeft: 6 }}>reps</span>
          </button>
        )}
      </Stepper>

      {next && (
        <div style={{ fontSize: 13, color: 'var(--color-sub)', textAlign: 'center' }}>
          Next: {next.sameExercise ? `set ${next.setNumber}` : next.name} ·{' '}
          <span className="tabular-nums">{next.weight || '—'} × {bareReps(next.reps)}</span>
        </div>
      )}
    </div>
  )
}

function Stepper({
  label,
  canStep,
  decLabel,
  incLabel,
  onStep,
  children,
}: {
  label: string
  canStep: boolean
  decLabel: string
  incLabel: string
  onStep: (direction: -1 | 1) => void
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {canStep ? <StepButton label={decLabel} onClick={() => onStep(-1)}>−</StepButton> : <div style={{ width: 56 }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>{children}</div>
      {canStep ? <StepButton label={incLabel} onClick={() => onStep(1)}>+</StepButton> : <div style={{ width: 56 }} />}
    </div>
  )
}

function StepButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="tap press"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: 16,
        border: '1px solid var(--color-pill-border)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontSize: 26,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}

const valueButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text)',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  padding: '6px 4px',
  minHeight: 48,
  minWidth: 0,
}
