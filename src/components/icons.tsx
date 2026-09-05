import {
  House,
  Dumbbell,
  Pencil,
  Trash2,
  Plus,
  ChevronDown as LucideChevronDown,
  ChevronLeft,
  History,
} from 'lucide-react'

/**
 * App icons — a single premade set (lucide-react) so everything matches.
 * lucide icons stroke with `currentColor`, so the parent sets active/idle color.
 * These thin wrappers keep the original component names + `size`/`open` props,
 * so call sites stay unchanged.
 */

/* ── Tab bar ─────────────────────────────────────────────────────────────── */

export function HomeIcon() {
  return <House size={21} strokeWidth={2} />
}

export function LibraryIcon() {
  return <Dumbbell size={21} strokeWidth={2} />
}

export function HistoryIcon() {
  return <History size={21} strokeWidth={2} />
}

/* ── Inline affordances ──────────────────────────────────────────────────── */

/** Back arrow for the Log header. */
export function BackChevron() {
  return <ChevronLeft size={22} strokeWidth={2.5} />
}

export function PlusGlyph({ size = 14 }: { size?: number }) {
  return <Plus size={size + 2} strokeWidth={2.5} />
}

export function TrashGlyph({ size = 14 }: { size?: number }) {
  return <Trash2 size={size + 2} strokeWidth={2} />
}

export function PencilGlyph({ size = 14 }: { size?: number }) {
  return <Pencil size={size + 2} strokeWidth={2} />
}

/** Disclosure chevron that flips when its section is open. */
export function ChevronDown({ open = false }: { open?: boolean }) {
  return (
    <LucideChevronDown
      size={18}
      strokeWidth={2.25}
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.18s ease',
      }}
    />
  )
}
