import type { Session, SessionType } from '@/db/types'

/**
 * Session kind helpers.
 *
 * Sessions predate the running program, so `type` is optional on the record and
 * absent means 'lift'. Every reader must go through `sessionType` rather than
 * touching `s.type` directly, or old sessions read as neither kind.
 */

export const sessionType = (s: Session): SessionType => s.type ?? 'lift'

export const isRun = (s: Session): boolean => sessionType(s) === 'run'
