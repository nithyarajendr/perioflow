import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { todayIso } from '../lib/utils'

/**
 * Hybrid date field — visually unmistakable as a date input (prominent
 * calendar icon on the left, tinted background, distinct border) while still
 * allowing both:
 *   • Click anywhere in the field → opens the platform date picker via
 *     showPicker() on a hidden <input type="date">.
 *   • Free-form typing in MM/DD/YYYY (also tolerates dashes, dots, 2-digit
 *     years) — parses on blur, silently reverts on invalid.
 *
 * The onChange contract matches `<input type="date">`: the event's
 * target.value is the canonical ISO YYYY-MM-DD.
 */
export default function DateField({ value, onChange, className = '', defaultEmpty = false, ...rest }) {
  const effectiveIso = value || (defaultEmpty ? '' : todayIso())
  const [text, setText] = useState(isoToDisplay(effectiveIso))
  const hiddenRef = useRef(null)
  const textRef = useRef(null)

  useEffect(() => { setText(isoToDisplay(effectiveIso)) }, [effectiveIso])

  const fireChange = (iso) => {
    onChange?.({ target: { value: iso } })
  }

  const commitTyped = () => {
    if (!text.trim()) {
      if (effectiveIso) fireChange('')
      return
    }
    const iso = parseDisplay(text)
    if (iso === null) {
      setText(isoToDisplay(effectiveIso))
    } else if (iso !== effectiveIso) {
      fireChange(iso)
    }
  }

  const openPicker = () => {
    const el = hiddenRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker() } catch { /* older browsers may throw */ }
    } else {
      el.click()
    }
  }

  // Click anywhere in the field opens the picker AND focuses the text input
  // (so once the user dismisses the picker with Escape, they can immediately
  // type a date instead).
  const onWrapperClick = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return
    textRef.current?.focus()
    openPicker()
  }

  return (
    <span
      onClick={onWrapperClick}
      className={`relative flex items-center w-full rounded-md bg-teal/5 border border-teal/40 hover:bg-teal/10 focus-within:bg-white focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/30 cursor-pointer transition-colors ${className}`}
    >
      <span className="absolute left-2.5 text-teal pointer-events-none">
        <Calendar size={16} strokeWidth={2} />
      </span>
      <input
        ref={textRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTyped() } }}
        placeholder="MM/DD/YYYY"
        inputMode="numeric"
        className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 py-2 pl-8 text-sm text-text-strong placeholder:text-text-muted focus:ring-0"
        {...rest}
      />
      {/* Hidden native date input — covers the full visible field so the
          OS picker overlay anchors to the field's bounding box instead of
          a 0-size element at the right edge (which on mobile pushed the
          calendar pop-up off-screen). pointer-events-none so taps still
          go to the visible text input above. */}
      <input
        ref={hiddenRef}
        type="date"
        value={effectiveIso}
        onChange={onChange}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  )
}

function isoToDisplay(iso) {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${m[2]}/${m[3]}/${m[1]}`
}

function parseDisplay(text) {
  const cleaned = text.trim().replace(/[.\-\s]/g, '/')
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(cleaned)
  if (!m) return null
  let [, monthStr, dayStr, yearStr] = m
  if (yearStr.length === 2) yearStr = (Number(yearStr) > 50 ? '19' : '20') + yearStr
  if (yearStr.length === 3) return null
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
