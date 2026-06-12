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

export function ProgressIcon() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 16 }}>
      <div style={{ width: 3.5, height: 8, borderRadius: 2, background: 'currentColor' }} />
      <div style={{ width: 3.5, height: 16, borderRadius: 2, background: 'currentColor' }} />
      <div style={{ width: 3.5, height: 12, borderRadius: 2, background: 'currentColor' }} />
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

export function PlusGlyph() {
  return (
    <div style={{ position: 'relative', width: 14, height: 14 }}>
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 0,
          width: 2,
          height: 14,
          background: 'currentColor',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 0,
          width: 14,
          height: 2,
          background: 'currentColor',
          borderRadius: 1,
        }}
      />
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
