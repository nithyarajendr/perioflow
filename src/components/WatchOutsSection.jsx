import { useState } from 'react'
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Watch-outs collapse/expand as a single unit. Header shows the count and
 * a chevron; clicking either toggles the body. Defaults to COLLAPSED so the
 * page stays scannable — the user can expand when they want to read the
 * warnings.
 */
export default function WatchOutsSection({ items }) {
  const [open, setOpen] = useState(false)
  const Chevron = open ? ChevronUp : ChevronDown
  if (!items || items.length === 0) return null
  return (
    <section className="border border-warning/40 bg-warning/10 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warning/15 transition-colors"
      >
        <AlertTriangle size={18} className="text-warning shrink-0" />
        <h3 className="font-serif text-lg text-text-strong flex-1">
          Watch-outs <span className="text-text-muted text-sm font-sans">({items.length} item{items.length === 1 ? '' : 's'})</span>
        </h3>
        <Chevron size={18} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-warning/30">
          {items.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-text-strong pt-2">
              <span className="text-warning shrink-0 mt-0.5">•</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
