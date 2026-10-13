import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/sync', () => ({ isEditMode: () => true, purgeLegacyRecovery: async () => {} }))
import { db } from './db'
import { applyBalancedSplit, migrateRequestedSplit } from './program'
import { mondayKey } from '@/lib/program'
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

  it('keeps the uppers push / pull and opens both lowers with arms', async () => {
    await applyBalancedSplit()
    const names = async (id: number) => (await db.exercises.where('dayId').equals(id).sortBy('order')).map((exercise) => exercise.name)
    const upper = ['Machine Press', 'T-Bar', 'Pec Dec', 'Lat Pulldown Mach', 'Lateral Raise']
    expect(await names(1)).toEqual(upper)
    expect(await names(3)).toEqual(upper)
    const lowerA = await names(2)
    const lowerB = await names(4)
    expect(lowerA.slice(0, 4)).toEqual(['Shoulder Press', 'Incline Curl', 'Single-Arm Tricep', 'Leg Press'])
    expect(lowerB.slice(0, 4)).toEqual(['Shoulder Press', 'Incline Curl', 'Single-Arm Tricep', 'SLDL'])
    expect(lowerA.slice(4)).toEqual(lowerB.slice(4))
  })

  it('moves a revision-1 install to the new plan once, keeping loads and history', async () => {
    // The plan as it stood before: arms on the uppers, weeks 9–16, four runs.
    const now = Date.now()
    const arms = await db.exercises.where('dayId').anyOf(2, 4).filter((exercise) => /Curl$|Tricep$|^Shoulder/.test(exercise.name) && exercise.name !== 'Leg Curl').toArray()
    for (const arm of arms) {
      await db.exercises.put({ ...arm, dayId: arm.dayId - 1, order: 7, weight: '14', setRows: [{ weight: '14', reps: '× 6' }] })
    }
    await db.days.toCollection().modify((day) => { day.splitRevision = 1; delete day.planRevision })
    const old = (await db.programWeeks.toArray()).map((week) => ({ ...week, id: week.id + 8, startDate: '2026-08-31' }))
    await db.programWeeks.clear()
    await db.programWeeks.bulkAdd(old)
    const sessionId = await startSession((await db.days.get(1))!, await db.exercises.where('dayId').equals(1).toArray(), { weekNumber: 15 })
    await finishSession(sessionId)
    const sets = await db.sets.toArray()

    await migrateRequestedSplit()

    const weeks = (await db.programWeeks.toArray()).sort((a, b) => a.id - b.id)
    expect(weeks.map((week) => week.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(weeks[0].startDate).toBe(mondayKey(new Date(now)))
    expect(weeks[0].slots.map((slot) => slot.run?.label ?? null)).toEqual(['Easy Run', null, 'Intervals', null, null, 'Long Run', null])
    expect(weeks[7].slots[5].run?.label).toBe('Time Trial')
    const lowerA = await db.exercises.where('dayId').equals(2).sortBy('order')
    expect(lowerA.slice(0, 3).map((exercise) => [exercise.name, exercise.weight])).toEqual([['Shoulder Press', '14'], ['Incline Curl', '14'], ['Single-Arm Tricep', '14']])
    expect((await db.exercises.where('dayId').equals(1).toArray()).some((exercise) => /Curl|Tricep|Shoulder/.test(exercise.name))).toBe(false)
    expect(await db.sets.toArray()).toEqual(sets)
    expect((await db.sessions.get(sessionId))?.weekNumber).toBe(15)

    // Once applied, later edits to the plan are left alone.
    await db.exercises.delete(lowerA[6].id)
    await db.programWeeks.update(1, { isDeload: true })
    await migrateRequestedSplit()
    expect(await db.exercises.get(lowerA[6].id)).toBeUndefined()
    expect((await db.programWeeks.get(1))?.isDeload).toBe(true)
  })

  it('takes a revision-2 install to 3 by moving only the shoulder press', async () => {
    // Revision 2 as it was first marked: press still on the uppers, lowers trimmed.
    for (const lower of [2, 4]) {
      const press = (await db.exercises.where('dayId').equals(lower).toArray()).find((exercise) => exercise.name === 'Shoulder Press')!
      await db.exercises.put({ ...press, dayId: lower - 1, order: 5, weight: '140 lb' })
    }
    await db.days.toCollection().modify((day) => { day.splitRevision = 2; delete day.planRevision })
    const trimmed = (await db.exercises.where('dayId').equals(2).toArray()).find((exercise) => exercise.name === 'Adductor')!
    await db.exercises.delete(trimmed.id)
    const pressId = (await db.exercises.where('dayId').equals(1).toArray()).find((exercise) => exercise.name === 'Shoulder Press')!.id
    const weeks = await db.programWeeks.toArray()

    await migrateRequestedSplit()

    expect((await db.days.toArray()).every((day) => day.splitRevision === 1 && day.planRevision === 3)).toBe(true)
    const lowerA = await db.exercises.where('dayId').equals(2).sortBy('order')
    expect(lowerA.map((exercise) => exercise.name).slice(0, 4)).toEqual(['Shoulder Press', 'Incline Curl', 'Single-Arm Tricep', 'Leg Press'])
    expect(lowerA[0]).toMatchObject({ id: pressId, weight: '140 lb' })
    expect(lowerA.map((exercise) => exercise.order)).toEqual(lowerA.map((_, index) => index + 1))
    expect(lowerA.some((exercise) => exercise.name === 'Adductor')).toBe(false)
    expect((await db.exercises.where('dayId').anyOf(1, 3).toArray()).some((exercise) => exercise.name === 'Shoulder Press')).toBe(false)
    expect((await db.exercises.where('dayId').equals(1).sortBy('order')).map((exercise) => exercise.order)).toEqual([1, 2, 3, 4, 5])
    expect(await db.programWeeks.toArray()).toEqual(weeks)
  })

  it('leaves the plan untouched while an affected workout is open', async () => {
    await startSession((await db.days.get(1))!, await db.exercises.where('dayId').equals(1).toArray())
    const before = await db.exercises.toArray()
    await expect(applyBalancedSplit()).rejects.toThrow('Finish or discard')
    expect(await db.exercises.toArray()).toEqual(before)
  })
})
