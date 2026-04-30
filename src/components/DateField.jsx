import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { todayIso } from '../lib/utils'

/**
 * Hybrid date field — typed entry as the primary UI, native picker as a
 * fallback for users who prefer to click. The visible input is plain text in
 * MM/DD/YYYY format; we parse on blur and forward the ISO YYYY-MM-DD value
 * via onChange (matching the original `<input type="date">` contract so all
 * existing call sites work unchanged).
 *
 * The native `<input type="date">` is rendered hidden alongside; the calendar
 * button calls showPicker() on it to open the platform picker.
 */
export default function DateField({ value, onChange, className = '', defaultEmpty = false, ...rest }) {
  const effectiveIso = value || (defaultEmpty ? '' : todayIso())
  const [text, setText] = useState(isoToDisplay(effectiveIso))
  const hiddenRef = useRef(null)

  // Resync the display when the upstream value changes (e.g. picker selection,
  // or another field updating the same date).
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
      // Invalid input — silently revert to the last good value so the user
      // sees their typo replaced rather than getting a stuck error state.
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

  return (
    <span className="relative block">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTyped() } }}
        placeholder="MM/DD/YYYY"
        inputMode="numeric"
        className={`${className} pr-9`}
        {...rest}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Open date picker"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-strong p-0.5"
      >
        <Calendar size={14} />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={effectiveIso}
        onChange={onChange}
        className="absolute right-0 top-0 opacity-0 w-0 h-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  )
}

// ISO YYYY-MM-DD → "MM/DD/YYYY" for display.
function isoToDisplay(iso) {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${m[2]}/${m[3]}/${m[1]}`
}

// Lenient parser: accepts MM/DD/YYYY, M/D/YY, MM-DD-YYYY, etc. Returns the
// canonical ISO YYYY-MM-DD, or null if the text doesn't look like a date.
// Two-digit years: 00-50 → 20xx, 51-99 → 19xx.
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
