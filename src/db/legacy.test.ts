import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/sync', () => ({ isEditMode: () => true, purgeLegacyRecovery: vi.fn(async () => {}) }))
import { db } from './db'
import { deleteLegacySplit } from './program'
import { purgeLegacyRecovery } from '@/lib/sync'

beforeEach(async () => { await Promise.all(db.tables.map((table) => table.clear())) })

it('deletes archived and active legacy data while retaining current templates, custom days, runs, and run prescriptions', async () => {
  await db.days.bulkAdd([
    { id: 1, name: 'Old renamed upper', focus: '', archived: true },
    { id: 2, name: 'Lower A', focus: '', slug: 'lower-a' },
    { id: 5, name: 'Upper C', focus: '' },
    { id: 10, name: 'Custom', focus: '' },
  ])
  for (const dayId of [1, 2, 5, 10]) {
    await db.exercises.add({ id: `e${dayId}`, dayId, name: 'Press', order: 1, sets: 1, weight: '', reps: '', updatedAt: 1 })
  }
  for (const dayId of [0, 1, 2, 5, 10]) {
    await db.sessions.add({ id: `s${dayId}`, dayId, date: '2026-09-14', startedAt: 1, durationSec: null, finishedAt: dayId === 5 ? null : 2, updatedAt: 2 })
    await db.sets.add({ id: `set${dayId}`, sessionId: `s${dayId}`, exerciseId: `e${dayId}`, exerciseName: 'Press', setIndex: 1, weight: '', reps: '', weightNum: null, repsNum: null, completedAt: 1, updatedAt: 1 })
  }
  const run = { label: 'Easy Run' as const, timing: 'after-lift' as const, durationMin: 25, hrZoneMin: 120, hrZoneMax: 140, hrHardCap: 145, strides: false, notes: null }
  await db.programWeeks.add({ id: 9, phase: 'base', startDate: '2026-09-14', isDeload: false, slots: [{ dow: 'mon', liftDayId: 1, run }, { dow: 'tue', liftDayId: 2, run: null }], updatedAt: 1 })
  await deleteLegacySplit()
  expect(await db.days.toCollection().primaryKeys()).toEqual([2, 10])
  expect(await db.exercises.toCollection().primaryKeys()).toEqual(['e10', 'e2'])
  expect(await db.sessions.toCollection().primaryKeys()).toEqual(['s0', 's10', 's2'])
  expect(await db.sets.toCollection().primaryKeys()).toEqual(['set0', 'set10', 'set2'])
  expect((await db.programWeeks.get(9))?.slots).toEqual([{ dow: 'mon', liftDayId: null, run }, { dow: 'tue', liftDayId: 2, run: null }])
  expect(purgeLegacyRecovery).toHaveBeenCalled()
  await deleteLegacySplit()
  expect(await db.days.count()).toBe(2)
})

it('automatically replaces a legacy-only install once and preserves later plan edits', async () => {
  const { migrateRequestedSplit } = await import('./program')
  await db.days.bulkAdd([
    { id: 1, name: 'Upper A', focus: '' },
    { id: 6, name: 'Lower C', focus: '', archived: true },
  ])
  await migrateRequestedSplit()
  const days = await db.days.toArray()
  expect(days.map((day) => day.slug)).toEqual(['upper-a', 'lower-a', 'upper-b', 'lower-b'])
  expect(days.every((day) => day.splitRevision === 1)).toBe(true)
  expect(await db.programWeeks.count()).toBe(8)
  const exercise = (await db.exercises.toArray())[0]
  await db.exercises.update(exercise.id, { name: 'My custom exercise', weight: '123 lb' })
  const before = await db.exercises.toArray()
  await migrateRequestedSplit()
  expect(await db.exercises.toArray()).toEqual(before)
})
