import type { LoadType } from '@/db/types'

/**
 * The load grammar: parse/format the canonical weight strings GymTrak stores.
 *
 * Storage stays a plain `string` (so display, carry-over, and sync are
 * unchanged); this module is the single place that understands its structure.
 * Each `LoadType` has one canonical written form:
 *   weight     → "225 lb"
 *   machine    → "10"  ·  "120 lb"  ·  "Max"  ·  "Max + 10"
 *   plates     → "6 pl"  ·  "5 pl + 25"
 *   bodyweight → "BW"  ·  "+70"  ·  "−25"
 *   free       → verbatim ("wtd", "heavy")
 */

export type StructuredLoad = {
  type: LoadType
  n?: number // weight pounds · machine pin reading · plates count
  max?: boolean // machine: top of the stack
  add?: number // machine(Max) extra · plates extra · bodyweight added/assisted
  lb?: boolean // machine: the pin reading is in pounds (vs a unitless level)
  text?: string // free
}

/** First (optionally signed) number in a string, or undefined. */
function firstNum(s: string): number | undefined {
  const m = s.match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

/**
 * Infer a load type from a raw weight string — used for legacy/untyped
 * exercises so nothing has to be migrated. Order matters.
 */
export function inferLoadType(raw: string): LoadType {
  const s = raw.trim()
  if (s === '') return 'weight'
  if (/pl\b/i.test(s) || /^\d+(?:\.\d+)?\s*\+\s*\d/.test(s)) return 'plates' // "6 pl", "5+25"
  if (/^BW\b/i.test(s) || /^\+\s*\d/.test(s)) return 'bodyweight' // "BW", "+70"
  if (/^Max\b/i.test(s)) return 'machine' // "Max", "Max+10"
  if (/^\d+(?:\.\d+)?\s*(?:lb|lbs)$/i.test(s)) return 'weight' // "225 lb"
  if (/^\d+(?:\.\d+)?$/.test(s)) return 'machine' // bare "10", "16"
  return 'free' // "wtd", "heavy"
}

/** Parse a raw weight string into structured fields, honoring an explicit type. */
export function parseLoad(raw: string, type?: LoadType): StructuredLoad {
  const s = raw.trim()
  const t = type ?? inferLoadType(s)
  switch (t) {
    case 'weight':
      return { type: 'weight', n: firstNum(s.replace(/lb|lbs/gi, '')) }
    case 'machine': {
      if (/^Max\b/i.test(s)) {
        const m = s.match(/\+\s*(\d+(?:\.\d+)?)/)
        return { type: 'machine', max: true, add: m ? Number(m[1]) : undefined }
      }
      // A pin reading is either a unitless level ("12") or pounds ("120 lb").
      return { type: 'machine', n: firstNum(s), lb: /\blbs?\b/i.test(s) }
    }
    case 'plates': {
      // "6 pl", "5 pl + 25", or bare "5+25"
      const m = s.match(
        /(\d+(?:\.\d+)?)\s*(?:pl(?:\.|ates)?)?(?:\s*\+\s*(\d+(?:\.\d+)?))?/i,
      )
      return {
        type: 'plates',
        n: m ? Number(m[1]) : undefined,
        add: m && m[2] != null ? Number(m[2]) : undefined,
      }
    }
    case 'bodyweight': {
      const m = s.match(/([+\-−])\s*(\d+(?:\.\d+)?)/)
      return {
        type: 'bodyweight',
        add: m ? (m[1] === '+' ? 1 : -1) * Number(m[2]) : undefined,
      }
    }
    default:
      return { type: 'free', text: raw }
  }
}

/** Format structured fields back to the canonical string. */
export function formatLoad(load: StructuredLoad): string {
  switch (load.type) {
    case 'weight':
      return load.n != null ? `${load.n} lb` : ''
    case 'machine':
      if (load.max) return load.add != null ? `Max + ${load.add}` : 'Max'
      if (load.n == null) return ''
      return load.lb ? `${load.n} lb` : `${load.n}`
    case 'plates':
      if (load.n == null) return ''
      return load.add != null ? `${load.n} pl + ${load.add}` : `${load.n} pl`
    case 'bodyweight':
      if (load.add == null || load.add === 0) return 'BW'
      return load.add < 0 ? `−${Math.abs(load.add)}` : `+${load.add}`
    case 'free':
      return load.text ?? ''
  }
}

/** Re-run a raw string through parse→format so it lands in canonical form. */
export function canonicalLoad(raw: string, type?: LoadType): string {
  return formatLoad(parseLoad(raw, type))
}
