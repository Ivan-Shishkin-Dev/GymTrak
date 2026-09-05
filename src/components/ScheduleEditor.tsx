import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Plus } from 'lucide-react'
import { duplicateProgramWeek, updateProgramWeek } from '@/lib/actions'
import { DOWS, dowLabel, mondayKey } from '@/lib/program'
import type { Day, Dow, ProgramSlot, ProgramWeek, RunPrescription } from '@/db/types'

const DEFAULT_RUN: RunPrescription = {
  label: 'Easy Run',
  timing: 'standalone',
  durationMin: 30,
  hrZoneMin: 120,
  hrZoneMax: 140,
  hrHardCap: 145,
  strides: false,
  notes: null,
}

export function ScheduleEditor({ weeks, days }: { weeks: ProgramWeek[]; days: Day[] }) {
  const ordered = useMemo(() => [...weeks].sort((a, b) => a.id - b.id), [weeks])
  const firstEditable = ordered.find((w) => w.startDate >= mondayKey(new Date())) ?? ordered.at(-1)
  const [selectedId, setSelectedId] = useState<number | null>(firstEditable?.id ?? null)
  const selected = ordered.find((w) => w.id === selectedId) ?? firstEditable
  const [draft, setDraft] = useState<ProgramWeek | null>(selected ? cloneWeek(selected) : null)
  const [saved, setSaved] = useState(false)
  const editable = !!selected && selected.startDate >= mondayKey(new Date())

  useEffect(() => {
    setDraft(selected ? cloneWeek(selected) : null)
    setSaved(false)
  }, [selected?.id, selected?.updatedAt])

  function setSlot(dow: Dow, patch: Partial<ProgramSlot>) {
    setDraft((week) => week ? {
      ...week,
      slots: week.slots.map((slot) => slot.dow === dow ? { ...slot, ...patch } : slot),
    } : week)
    setSaved(false)
  }

  function setRun(dow: Dow, patch: Partial<RunPrescription>) {
    const slot = draft?.slots.find((candidate) => candidate.dow === dow)
    if (!slot?.run) return
    setSlot(dow, { run: { ...slot.run, ...patch } })
  }

  if (!ordered.length || !draft) return null

  return (
    <section className="card" style={{ borderRadius: 16, padding: 16, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>Schedule editor</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--color-sub)' }}>
            Current and future weeks only
          </div>
        </div>
        <select
          aria-label="Week to edit"
          value={draft.id}
          onChange={(event) => setSelectedId(Number(event.target.value))}
          style={{ ...fieldStyle, width: 'auto', minWidth: 92 }}
        >
          {ordered.map((week) => <option key={week.id} value={week.id}>Week {week.id}</option>)}
        </select>
      </div>

      {!editable && (
        <div style={{ marginTop: 12, borderRadius: 10, background: 'rgba(245,185,69,.08)', padding: '10px 11px', color: 'var(--color-amber)', fontSize: 12.5 }}>
          Past weeks are locked so completed history stays truthful. Duplicate this week to reuse it.
        </div>
      )}

      <label style={checkLabel}>
        <input
          type="checkbox"
          checked={draft.isDeload}
          disabled={!editable}
          onChange={(event) => setDraft({ ...draft, isDeload: event.target.checked })}
        />
        Deload week
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {DOWS.map((dow) => {
          const slot = draft.slots.find((candidate) => candidate.dow === dow) ?? { dow, liftDayId: null, run: null }
          return (
            <div key={dow} style={{ padding: '12px 0', borderTop: '1px solid var(--color-separator)' }}>
              <div className="eyebrow" style={{ color: 'var(--color-sub)', marginBottom: 8 }}>
                {dowLabel(dow).toUpperCase()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <select
                  aria-label={`${dowLabel(dow)} lift`}
                  value={slot.liftDayId ?? ''}
                  disabled={!editable}
                  onChange={(event) => setSlot(dow, { liftDayId: event.target.value ? Number(event.target.value) : null })}
                  style={fieldStyle}
                >
                  <option value="">No lift</option>
                  {days.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}
                </select>
                <button
                  className="tap"
                  disabled={!editable}
                  onClick={() => setSlot(dow, { run: slot.run ? null : { ...DEFAULT_RUN, timing: slot.liftDayId ? 'after-lift' : 'standalone' } })}
                  style={{ ...smallButton, color: slot.run ? 'var(--color-volt)' : 'var(--color-sub)' }}
                >
                  {slot.run ? <><Check size={13} /> Run</> : <><Plus size={13} /> Run</>}
                </button>
              </div>

              {slot.run && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <label style={labelStyle}>Type
                    <select value={slot.run.label} disabled={!editable} onChange={(event) => setRun(dow, { label: event.target.value as RunPrescription['label'] })} style={fieldStyle}>
                      <option>Easy Run</option><option>Long Run</option>
                    </select>
                  </label>
                  <NumberField label="Minutes" value={slot.run.durationMin} disabled={!editable} onChange={(value) => setRun(dow, { durationMin: value })} />
                  <NumberField label="HR minimum" value={slot.run.hrZoneMin} disabled={!editable} onChange={(value) => setRun(dow, { hrZoneMin: value })} />
                  <NumberField label="HR maximum" value={slot.run.hrZoneMax} disabled={!editable} onChange={(value) => setRun(dow, { hrZoneMax: value })} />
                  <NumberField label="Hard cap" value={slot.run.hrHardCap} disabled={!editable} onChange={(value) => setRun(dow, { hrHardCap: value })} />
                  <label style={{ ...checkLabel, marginTop: 19 }}>
                    <input type="checkbox" checked={slot.run.strides} disabled={!editable} onChange={(event) => setRun(dow, { strides: event.target.checked })} />
                    Strides
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          className="tap press"
          disabled={!editable}
          onClick={async () => {
            await updateProgramWeek(draft)
            setSaved(true)
          }}
          style={{ ...actionStyle, opacity: editable ? 1 : 0.4 }}
        >
          {saved ? <Check size={15} /> : null}{saved ? 'Saved' : 'Save week'}
        </button>
        <button
          className="tap"
          onClick={async () => {
            const id = await duplicateProgramWeek(draft.id)
            if (id != null) setSelectedId(id)
          }}
          style={{ ...actionStyle, background: 'transparent', color: 'var(--color-sub)', border: '1px solid var(--color-pill-border)' }}
        >
          <Copy size={14} /> Add next week
        </button>
      </div>
    </section>
  )
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <label style={labelStyle}>{label}
      <input type="number" inputMode="numeric" value={value} disabled={disabled} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} style={fieldStyle} />
    </label>
  )
}

function cloneWeek(week: ProgramWeek): ProgramWeek {
  return { ...week, slots: week.slots.map((slot) => ({ ...slot, run: slot.run ? { ...slot.run } : null })) }
}

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 38, borderRadius: 9,
  border: '1px solid var(--color-pill-border)', background: 'var(--color-bg)',
  color: 'var(--color-text)', padding: '0 10px', fontSize: 13,
}
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--color-sub)', fontSize: 11.5 }
const checkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--color-sub)', fontSize: 12.5 }
const smallButton: React.CSSProperties = { height: 38, borderRadius: 9, border: '1px solid var(--color-pill-border)', background: 'transparent', display: 'flex', alignItems: 'center', gap: 5, padding: '0 11px', fontSize: 12.5, fontWeight: 650 }
const actionStyle: React.CSSProperties = { flex: 1, minHeight: 44, borderRadius: 11, border: 0, background: 'var(--color-volt)', color: 'var(--color-on-volt)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }
