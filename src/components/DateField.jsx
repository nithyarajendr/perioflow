import { useRef } from 'react'
import { todayIso } from '../lib/utils'

/**
 * A date input where clicking anywhere in the field opens the native calendar
 * picker — not just the calendar icon — but the user can also type a date with
 * the keyboard.
 *
 * Why we only call showPicker() on click (not focus): the picker steals key
 * events on most browsers, so binding to focus would prevent typing whenever
 * the user tabs in or refocuses after dismissing. Click is the intentional
 * "open picker" gesture; keyboard focus stays as plain text editing.
 *
 * Defaults to today when value is empty/null unless `defaultEmpty` is set.
 */
export default function DateField({ value, onChange, className = '', defaultEmpty = false, ...rest }) {
  const ref = useRef(null)
  const effective = value || (defaultEmpty ? '' : todayIso())

  const openPicker = () => {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker() } catch { /* older Safari may throw; user can still type */ }
    }
  }

  return (
    <input
      ref={ref}
      type="date"
      value={effective}
      onChange={onChange}
      onClick={openPicker}
      className={className}
      {...rest}
    />
  )
}
