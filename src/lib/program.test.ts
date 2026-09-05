import { describe, expect, it } from 'vitest'
import { formatLoad, parseLoad } from '@/lib/load'
import { slotDate, slotSummary } from '@/lib/program'
import type { ProgramWeek } from '@/db/types'

describe('program helpers', () => {
  const week: ProgramWeek = {
    id: 9, phase: 'base', startDate: '2026-08-31', isDeload: false, updatedAt: 1,
    slots: [{ dow: 'mon', liftDayId: 1, run: null }],
  }

  it('keeps schedule dates local and Monday-based', () => {
    expect(slotDate(week, 'mon')).toBe('2026-08-31')
    expect(slotDate(week, 'fri')).toBe('2026-09-04')
    expect(slotSummary(week.slots[0], 'Upper A')).toBe('Upper A')
  })

  it('round-trips adjustable load values', () => {
    const load = parseLoad('225 lb', 'weight')
    load.n = (load.n ?? 0) + 5
    expect(formatLoad(load)).toBe('230 lb')
  })
})
