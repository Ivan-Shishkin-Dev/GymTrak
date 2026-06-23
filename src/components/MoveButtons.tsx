import { ArrowUp, ArrowDown } from 'lucide-react'
import type { CSSProperties } from 'react'

const btnBase: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-faint)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 30,
  borderRadius: 8,
  padding: 0,
}

/** Up/down reorder pair (edit mode). Dimmed + inert at the ends of the list. */
export function MoveButtons({
  onMove,
  canUp,
  canDown,
  stopProp = false,
}: {
  onMove: (dir: -1 | 1) => void
  canUp: boolean
  canDown: boolean
  stopProp?: boolean
}) {
  const Btn = (dir: -1 | 1, can: boolean, Icon: typeof ArrowUp) => (
    <button
      className="tap"
      disabled={!can}
      aria-label={dir === -1 ? 'Move up' : 'Move down'}
      onClick={(e) => {
        if (stopProp) e.stopPropagation()
        if (can) onMove(dir)
      }}
      style={{ ...btnBase, opacity: can ? 1 : 0.3, cursor: can ? 'pointer' : 'default' }}
    >
      <Icon size={15} strokeWidth={2.2} />
    </button>
  )
  return (
    <>
      {Btn(-1, canUp, ArrowUp)}
      {Btn(1, canDown, ArrowDown)}
    </>
  )
}
