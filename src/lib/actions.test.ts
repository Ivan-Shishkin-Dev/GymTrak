import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/sync', () => ({ isEditMode: () => true }))
import { db } from '@/db/db'
import { duplicateProgramWeek, finishSession, reopenSession, startSession } from '@/lib/actions'
import type { Day, Exercise } from '@/db/types'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

describe('lift session lifecycle', () => {
  it('snapshots the schedule and only carries completed performance forward', async () => {
    const now = Date.now()
    const day: Day = { id: 1, order: 1, name: 'Upper A', focus: 'Press', updatedAt: now }
    const exercise: Exercise = {
      id: 'press', dayId: 1, order: 1, name: 'Press', sets: 2,
      weight: '100 lb', reps: '× 5', loadType: 'weight',
      setRows: [{ weight: '100 lb', reps: '× 5' }, { weight: '90 lb', reps: '× 6' }],
      updatedAt: now,
    }
    await db.days.add(day)
    await db.exercises.add(exercise)

    const id = await startSession(day, [exercise], { scheduledDate: '2026-09-01', weekNumber: 9 })
    const sessionSets = (await db.sets.where('sessionId').equals(id).sortBy('setIndex'))
    await db.sets.update(sessionSets[0].id, { weight: '105 lb', completedAt: now + 1 })
    await db.sets.update(sessionSets[1].id, { weight: '500 lb' })
    await finishSession(id)

    const session = await db.sessions.get(id)
    const carried = await db.exercises.get(exercise.id)
    expect(session).toMatchObject({ scheduledDate: '2026-09-01', dayNameSnapshot: 'Upper A', focusSnapshot: 'Press' })
    expect(carried?.setRows).toEqual([
      { weight: '105 lb', reps: '× 5' },
      { weight: '90 lb', reps: '× 6' },
    ])
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(2)
  })

  it('can reopen a finished session without losing unfinished rows', async () => {
    const now = Date.now()
    const day: Day = { id: 2, name: 'Lower', focus: '', updatedAt: now }
    const exercise: Exercise = { id: 'squat', dayId: 2, order: 1, name: 'Squat', sets: 1, weight: '200 lb', reps: '× 5', updatedAt: now }
    await db.days.add(day)
    await db.exercises.add(exercise)
    const id = await startSession(day, [exercise])
    await finishSession(id)
    await reopenSession(id)
    expect((await db.sessions.get(id))?.finishedAt).toBeNull()
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(1)
  })
})

describe('program editing', () => {
  it('duplicates a source week after the current last week', async () => {
    await db.programWeeks.add({
      id: 9,
      phase: 'base',
      startDate: '2026-08-31',
      isDeload: false,
      slots: [{ dow: 'mon', liftDayId: 1, run: null }],
      updatedAt: 1,
    })
    expect(await duplicateProgramWeek(9)).toBe(10)
    expect(await db.programWeeks.get(10)).toMatchObject({
      id: 10,
      startDate: '2026-09-07',
      slots: [{ dow: 'mon', liftDayId: 1, run: null }],
    })
  })
})
