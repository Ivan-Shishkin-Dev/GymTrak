import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/sync', () => ({ isEditMode: () => true, purgeLegacyRecovery: async () => {} }))
import { db } from './db'
import { applyBalancedSplit } from './program'
import { seedIfEmpty } from './seed'
import { finishSession, startSession } from '@/lib/actions'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  await seedIfEmpty()
})

describe('balanced split update', () => {
  it('preserves progressed loads, exercise identities, history, and the schedule on repeated updates', async () => {
    const day = (await db.days.get(1))!
    const exercises = await db.exercises.where('dayId').equals(1).toArray()
    const row = exercises.find((exercise) => exercise.name === 'T-Bar')!
    await db.exercises.update(row.id, { weight: '6 pl', setRows: [{ weight: '6 pl', reps: '× 8' }] })
    const legacy = { ...row, id: 'old-dip', name: 'Dip', order: 9 }
    await db.exercises.add(legacy)
    const sessionId = await startSession(day, [legacy])
    await finishSession(sessionId)
    const sets = await db.sets.toArray()
    const sessions = await db.sessions.toArray()
    const weeks = await db.programWeeks.toArray()
    await applyBalancedSplit()
    const ids = (await db.exercises.toArray()).map((exercise) => exercise.id).sort()
    await applyBalancedSplit()
    expect((await db.exercises.toArray()).map((exercise) => exercise.id).sort()).toEqual(ids)
    expect(await db.exercises.get(row.id)).toMatchObject({ weight: '6 pl', setRows: [{ weight: '6 pl', reps: '× 8' }] })
    expect(await db.exercises.get(legacy.id)).toBeUndefined()
    expect(await db.sets.toArray()).toEqual(sets)
    expect(await db.sessions.toArray()).toEqual(sessions)
    expect(await db.programWeeks.toArray()).toEqual(weeks)
  })

  it('gives both uppers the requested order and both lowers identical accessories', async () => {
    await applyBalancedSplit()
    const names = async (id: number) => (await db.exercises.where('dayId').equals(id).sortBy('order')).map((exercise) => exercise.name)
    const upper = ['Machine Press', 'T-Bar', 'Pec Dec', 'Lat Pulldown Mach', 'Shoulder Press', 'Lateral Raise', 'Incline Curl', 'Single-Arm Tricep']
    expect(await names(1)).toEqual(upper)
    expect(await names(3)).toEqual(upper)
    const lowerA = await names(2)
    const lowerB = await names(4)
    expect(lowerA[0]).toBe('Leg Press')
    expect(lowerB[0]).toBe('SLDL')
    expect(lowerA.slice(1)).toEqual(lowerB.slice(1))
    expect(lowerA).toContain('Leg Curl')
    expect(lowerA).toContain('Leg Extension')
  })

  it('leaves the plan untouched while an affected workout is open', async () => {
    await startSession((await db.days.get(1))!, await db.exercises.where('dayId').equals(1).toArray())
    const before = await db.exercises.toArray()
    await expect(applyBalancedSplit()).rejects.toThrow('Finish or discard')
    expect(await db.exercises.toArray()).toEqual(before)
  })
})
