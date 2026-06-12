import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Library() {
  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0 8px' }}>
        <div style={{ fontSize: 34, fontWeight: 760, letterSpacing: '-0.02em' }}>
          Library
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--color-sub)' }}>
          ULULUL split · 6 days · Sunday rest
        </div>
      </div>

      {days.map((day) => {
        const rows = exercises
          .filter((e) => e.dayId === day.id)
          .sort((a, b) => a.order - b.order)
        return (
          <div
            key={day.id}
            className="card"
            style={{ borderRadius: 22, padding: '6px 18px 8px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '12px 0 6px',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 660 }}>{day.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-sub)' }}>
                {day.focus} · {WEEKDAY_SHORT[day.weekday]}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((ex) => (
                <div
                  key={ex.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}
                >
                  <div style={{ flex: 1, fontSize: 13.5, color: 'var(--color-d9)' }}>
                    {ex.name}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: 12.5, color: 'var(--color-sub)' }}
                  >
                    {ex.sets} · {ex.libLoad}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
