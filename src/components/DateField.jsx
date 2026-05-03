import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { todayIso } from '../lib/utils'

/**
 * Hybrid date field, cross-platform:
 *
 *   • Desktop (mouse + keyboard) — visible text input is editable. Click
 *     the field to open the platform date picker via showPicker(). Type
 *     MM/DD/YYYY directly; we parse on blur, silently revert on invalid.
 *
 *   • Touch devices (iPhone, iPad, Android) — the hidden <input type="date">
 *     is the actual tap target. Tapping the field opens the OS's native
 *     date picker on EVERY mobile browser (iOS Safari/Chrome, Android
 *     Chrome/Firefox/Samsung Internet) without relying on showPicker(),
 *     which is version-gated and unreliable. The visible text input is
 *     readOnly so it doesn't pop the virtual keyboard.
 *
 * Touch detection uses `(hover: none) and (pointer: coarse)` — true on
 * every phone/tablet, false on every desktop (including touchscreens that
 * also have a mouse). Reads on mount; no SSR concerns since this app is
 * client-rendered.
 *
 * The onChange contract matches `<input type="date">`: the event's
 * target.value is the canonical ISO YYYY-MM-DD.
 */
export default function DateField({ value, onChange, className = '', defaultEmpty = false, ...rest }) {
  const effectiveIso = value || (defaultEmpty ? '' : todayIso())
  const [text, setText] = useState(isoToDisplay(effectiveIso))
  const [isTouch, setIsTouch] = useState(false)
  const hiddenRef = useRef(null)
  const textRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
    }
  }, [])

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

  // Desktop only: click anywhere in the field opens the picker AND focuses
  // the text input (so once the picker is dismissed with Esc, the user can
  // immediately type a date instead). On touch devices we don't bind this
  // — the hidden native input handles the tap directly, opening the OS
  // picker without any JS.
  const onWrapperClick = (e) => {
    if (isTouch) return
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
        onChange={isTouch ? undefined : (e => setText(e.target.value))}
        onBlur={isTouch ? undefined : commitTyped}
        onKeyDown={isTouch ? undefined : (e => { if (e.key === 'Enter') { e.preventDefault(); commitTyped() } })}
        readOnly={isTouch}
        placeholder="MM/DD/YYYY"
        // inputMode="text" so the desktop full keyboard (with /) appears
        // when the user types. On touch devices the field is readOnly so
        // the keyboard never opens anyway.
        inputMode="text"
        className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 py-2 pl-8 text-sm text-text-strong placeholder:text-text-muted focus:ring-0"
        {...rest}
      />
      {/* Hidden native date input. On TOUCH devices it's tappable and covers
          the field (opacity-0), so taps land on it and open the OS native
          picker — works on iOS Safari/Chrome, Android Chrome/Firefox/Samsung
          Internet, no JS, no version dependencies.
          On DESKTOP it stays pointer-events-none (the visible text input
          gets the clicks for typing; showPicker() opens the picker). */}
      <input
        ref={hiddenRef}
        type="date"
        value={effectiveIso}
        onChange={onChange}
        className={`absolute inset-0 w-full h-full opacity-0 ${isTouch ? 'cursor-pointer' : 'pointer-events-none'}`}
        tabIndex={isTouch ? 0 : -1}
        aria-hidden={!isTouch}
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
