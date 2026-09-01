import type { Day } from '@/db/types'

/**
 * Day ordering helpers.
 *
 * The Library is a list of lift days the user can reorder; `id` is the stable key
 * and `order` is the editable slot. Older records (and the original seed) have no
 * `order`, so we fall back to `id` — which preserves the original 1..n ordering
 * until days are reordered.
 *
 * The completion-driven rotation that used to live here (`nextInCycle` and
 * friends) is gone: Home now reads the calendar week from the running program
 * rather than guessing the next day from your last finished session.
 */

/** Rotation position of a day. */
export const dayRank = (d: Day): number => d.order ?? d.id

/** Sort comparator for rotation order. */
export const byDayOrder = (a: Day, b: Day): number => dayRank(a) - dayRank(b)
