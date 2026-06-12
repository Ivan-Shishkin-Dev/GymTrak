import type { CSSProperties } from 'react'

/**
 * The geometric glyphs from the prototype, rebuilt 1:1 with divs so they match
 * the design exactly (rather than an icon set that only approximates them).
 * All use `currentColor`, so the parent sets active/idle color.
 */

const sq = (n: number, r: number): CSSProperties => ({
  width: n,
  height: n,
  borderRadius: r,
  background: 'currentColor',
})

export function HomeIcon() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8px 8px', gap: 3 }}>
      <div style={sq(8, 2.5)} />
      <div style={sq(8, 2.5)} />
      <div style={sq(8, 2.5)} />
      <div style={sq(8, 2.5)} />
    </div>
  )
}

export function HistoryIcon() {
  return (
    <div
      style={{
        width: 18,
        height: 17,
        border: '2px solid currentColor',
        borderRadius: 5,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 3,
          top: 6,
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: 'currentColor',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 3,
          top: 6,
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: 'currentColor',
        }}
      />
    </div>
  )
}

export function LibraryIcon() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ width: 16, height: 2, borderRadius: 1, background: 'currentColor' }} />
      <div style={{ width: 16, height: 2, borderRadius: 1, background: 'currentColor' }} />
      <div style={{ width: 10, height: 2, borderRadius: 1, background: 'currentColor' }} />
    </div>
  )
}

export function BackChevron() {
  return (
    <div
      style={{
        width: 9,
        height: 9,
        borderLeft: '2.5px solid #D9D9DE',
        borderBottom: '2.5px solid #D9D9DE',
        transform: 'rotate(45deg)',
        marginLeft: 3,
      }}
    />
  )
}

/** A thin "+" built from two bars — inherits `currentColor`. */
export function PlusGlyph({ size = 14, thick = 2 }: { size?: number; thick?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: size,
          height: thick,
          marginTop: -thick / 2,
          borderRadius: thick,
          background: 'currentColor',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width: thick,
          height: size,
          marginLeft: -thick / 2,
          borderRadius: thick,
          background: 'currentColor',
        }}
      />
    </div>
  )
}

/** A minimal trash glyph (lid + bin) — inherits `currentColor`. */
export function TrashGlyph({ size = 14 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 1,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size * 0.72,
          height: 2,
          borderRadius: 2,
          background: 'currentColor',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size * 0.58,
          height: size - 5,
          borderRadius: '0 0 3px 3px',
          border: '1.6px solid currentColor',
          borderTop: 'none',
        }}
      />
    </div>
  )
}

/** A pencil glyph for "edit" affordances — inherits `currentColor`. */
export function PencilGlyph({ size = 14 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        transform: 'rotate(0deg)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: size * 0.82,
          height: 3,
          borderRadius: 1,
          background: 'currentColor',
          transform: 'rotate(-45deg)',
          transformOrigin: 'left bottom',
        }}
      />
    </div>
  )
}

/** A chevron that points down by default; rotate via the `open` prop. */
export function ChevronDown({ open = false, size = 8 }: { open?: boolean; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRight: '2px solid currentColor',
        borderBottom: '2px solid currentColor',
        transform: open ? 'rotate(-135deg)' : 'rotate(45deg)',
        transition: 'transform 0.18s ease',
      }}
    />
  )
}
