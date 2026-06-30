import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LoadType } from '@/db/types'
import { parseLoad, formatLoad } from '@/lib/load'

/**
 * Guided weight input. The fields shown are driven by the exercise's `loadType`,
 * and every change emits the canonical string (via `onChange`) that gets stored
 * — so the parent keeps persisting a plain string exactly as before. Used inline
 * in the Library editor (full width) and the Log set list (`compact`).
 *
 * It keeps its own field buffer (seeded from `value`) so partial input like
 * "4." survives keystrokes; it re-seeds from `value` whenever the prop changes
 * while unfocused (e.g. the Library removes a set row, or the type switches).
 */

type Fields = {
  nStr: string
  addStr: string
  addSign: '+' | '-'
  maxOn: boolean
  lbOn: boolean
  text: string
}

function initFields(value: string, loadType: LoadType): Fields {
  const p = parseLoad(value, loadType)
  return {
    nStr: p.n != null ? String(p.n) : '',
    addStr: p.add != null ? String(Math.abs(p.add)) : '',
    addSign: p.add != null && p.add < 0 ? '-' : '+',
    maxOn: !!p.max,
    lbOn: !!p.lb,
    text: p.text ?? value,
  }
}

function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const x = Number(s)
  return Number.isFinite(x) ? x : undefined
}

function toCanonical(loadType: LoadType, f: Fields): string {
  const n = toNum(f.nStr)
  const add = toNum(f.addStr)
  switch (loadType) {
    case 'weight':
      return formatLoad({ type: 'weight', n })
    case 'machine':
      return f.maxOn
        ? formatLoad({ type: 'machine', max: true, add })
        : formatLoad({ type: 'machine', n, lb: f.lbOn })
    case 'plates':
      return formatLoad({ type: 'plates', n, add })
    case 'bodyweight':
      return add == null
        ? 'BW'
        : formatLoad({ type: 'bodyweight', add: f.addSign === '-' ? -add : add })
    case 'free':
      return f.text
  }
}

type Props = {
  value: string
  loadType: LoadType
  compact?: boolean
  autoFocus?: boolean
  onChange: (canonical: string) => void
  onCommit?: () => void
  onCancel?: () => void
}

export function LoadEditor({
  value,
  loadType,
  compact,
  autoFocus,
  onChange,
  onCommit,
  onCancel,
}: Props) {
  const [fields, setFields] = useState(() => initFields(value, loadType))
  const focused = useRef(false)
  // The last canonical string we emitted, so the re-seed below can ignore its own
  // echo — otherwise a mode toggle (e.g. machine Max) round-trips through a lossy
  // canonical string and wipes the hidden field (the pin reading).
  const lastEmitted = useRef<string | null>(null)

  // Re-seed from the prop when it changes externally (only while not focused,
  // so it never clobbers what the user is typing). Skip our own echo so toggles
  // stay non-destructive; genuine external changes still re-seed.
  useEffect(() => {
    if (value !== lastEmitted.current && !focused.current) {
      setFields(initFields(value, loadType))
    }
    lastEmitted.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loadType])

  function update(patch: Partial<Fields>) {
    const next = { ...fields, ...patch }
    setFields(next)
    const canonical = toCanonical(loadType, next)
    lastEmitted.current = canonical
    onChange(canonical)
  }

  const inputBase: CSSProperties = compact
    ? {
        background: 'var(--color-bg)',
        border: '1px solid var(--color-volt)',
        borderRadius: 8,
        color: 'var(--color-text)',
        padding: '4px 8px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-mono)',
        fontSize: 15,
        fontWeight: 620,
      }
    : {
        background: 'var(--color-bg)',
        border: '1px solid var(--color-pill-border)',
        borderRadius: 10,
        color: 'var(--color-text)',
        padding: '8px 10px',
        fontSize: 13.5,
        outline: 'none',
        boxSizing: 'border-box',
      }

  const dim: CSSProperties = {
    fontSize: compact ? 13 : 12.5,
    color: 'var(--color-dim)',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
  }
  const strong: CSSProperties = {
    fontSize: compact ? 15 : 14,
    fontWeight: 640,
    color: 'var(--color-text)',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
  }
  const chip = (active: boolean): CSSProperties => ({
    height: compact ? 28 : 30,
    padding: '0 10px',
    borderRadius: 14,
    border: active ? '1px solid var(--color-volt)' : '1px solid var(--color-pill-border)',
    background: active ? 'var(--color-volt-tint)' : 'transparent',
    color: active ? 'var(--color-volt)' : 'var(--color-sub)',
    fontSize: 12,
    fontWeight: 640,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    flexShrink: 0,
  })

  const numField = (w: number): CSSProperties => ({ ...inputBase, width: w })
  // minWidth keeps a 2–3 digit load readable; extra controls (lb/Max chips) wrap
  // to the next line rather than crushing the number field to a single digit.
  const grow: CSSProperties = compact ? { ...inputBase, width: 84 } : { ...inputBase, flex: 1, minWidth: 56 }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          focused.current = false
          onCommit?.()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
          onCommit?.()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel?.()
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
    >
      {loadType === 'weight' && (
        <>
          <input
            className="tabular-nums"
            value={fields.nStr}
            onChange={(e) => update({ nStr: e.target.value })}
            inputMode="decimal"
            placeholder="225"
            autoFocus={autoFocus}
            style={grow}
          />
          <span style={dim}>lb</span>
        </>
      )}

      {loadType === 'machine' && (
        <>
          {fields.maxOn ? (
            <>
              <span style={strong}>Max</span>
              <span style={dim}>+</span>
              <input
                className="tabular-nums"
                value={fields.addStr}
                onChange={(e) => update({ addStr: e.target.value })}
                inputMode="decimal"
                placeholder="0"
                autoFocus={autoFocus}
                style={numField(56)}
              />
            </>
          ) : (
            <>
              <input
                className="tabular-nums"
                value={fields.nStr}
                onChange={(e) => update({ nStr: e.target.value })}
                inputMode="decimal"
                placeholder="10"
                autoFocus={autoFocus}
                style={grow}
              />
              {fields.lbOn && <span style={dim}>lb</span>}
            </>
          )}
          <button type="button" onClick={() => update({ maxOn: !fields.maxOn })} style={chip(fields.maxOn)}>
            Max
          </button>
          {!fields.maxOn && (
            <button type="button" onClick={() => update({ lbOn: !fields.lbOn })} style={chip(fields.lbOn)}>
              lb
            </button>
          )}
        </>
      )}

      {loadType === 'plates' && (
        <>
          <input
            className="tabular-nums"
            value={fields.nStr}
            onChange={(e) => update({ nStr: e.target.value })}
            inputMode="decimal"
            placeholder="6"
            autoFocus={autoFocus}
            style={numField(54)}
          />
          <span style={dim}>pl</span>
          <span style={dim}>+</span>
          <input
            className="tabular-nums"
            value={fields.addStr}
            onChange={(e) => update({ addStr: e.target.value })}
            inputMode="decimal"
            placeholder="0"
            style={numField(54)}
          />
          <span style={dim}>lb</span>
        </>
      )}

      {loadType === 'bodyweight' && (
        <>
          <span style={strong}>BW</span>
          <button
            type="button"
            onClick={() => update({ addSign: fields.addSign === '+' ? '-' : '+' })}
            style={chip(false)}
            aria-label="Toggle added or assisted"
          >
            {fields.addSign}
          </button>
          <input
            className="tabular-nums"
            value={fields.addStr}
            onChange={(e) => update({ addStr: e.target.value })}
            inputMode="decimal"
            placeholder="0"
            autoFocus={autoFocus}
            style={numField(56)}
          />
          <span style={dim}>lb</span>
        </>
      )}

      {loadType === 'free' && (
        <input
          value={fields.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="e.g. heavy"
          autoFocus={autoFocus}
          style={grow}
        />
      )}
    </div>
  )
}

/* ── Reps ────────────────────────────────────────────────────────────────── */

type RepsProps = {
  value: string
  compact?: boolean
  autoFocus?: boolean
  onChange: (canonical: string) => void
  onCommit?: () => void
  onCancel?: () => void
}

/** Guided reps field: edits the bare count, emits "× N". Ranges pass through. */
export function RepsField({ value, compact, autoFocus, onChange, onCommit, onCancel }: RepsProps) {
  const strip = (v: string) => v.replace(/^\s*[×x]\s*/i, '')
  const [text, setText] = useState(() => strip(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(strip(value))
  }, [value])

  function set(t: string) {
    setText(t)
    onChange(t.trim() === '' ? '' : `× ${t.trim()}`)
  }

  const base: CSSProperties = compact
    ? {
        background: 'var(--color-bg)',
        border: '1px solid var(--color-volt)',
        borderRadius: 8,
        color: 'var(--color-text)',
        padding: '4px 8px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        textAlign: 'right',
        width: 64,
      }
    : {
        background: 'var(--color-bg)',
        border: '1px solid var(--color-pill-border)',
        borderRadius: 10,
        color: 'var(--color-text)',
        padding: '8px 10px',
        fontSize: 13.5,
        outline: 'none',
        boxSizing: 'border-box',
        width: 80,
        flex: '0 0 auto',
      }

  return (
    <input
      className="tabular-nums"
      value={text}
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder="6"
      onClick={(e) => e.stopPropagation()}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => {
        e.stopPropagation()
        set(e.target.value)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit?.()
        if (e.key === 'Escape') onCancel?.()
      }}
      onBlur={() => {
        focused.current = false
        onCommit?.()
      }}
      style={base}
    />
  )
}
