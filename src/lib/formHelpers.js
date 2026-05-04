/**
 * On Enter in a text input, focus the next focusable form control in DOM
 * order. Skips Shift+Enter (so power users can still insert a newline in a
 * textarea via shift). Skips when target is a textarea (Enter inserts a
 * newline) unless `acceptTextarea` is true. Doesn't submit forms.
 *
 * Usage:
 *   <input ... onKeyDown={enterToNextField} />
 */
export function enterToNextField(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.metaKey) return
  if (e.currentTarget.tagName === 'TEXTAREA') return
  const root = e.currentTarget.closest('form, [data-enter-advance], main') || document.body
  const all = Array.from(
    root.querySelectorAll('input, select, textarea, button')
  ).filter(el =>
    !el.disabled
    && el.tabIndex !== -1
    && el.type !== 'hidden'
    && el.offsetParent !== null  // visible
  )
  const idx = all.indexOf(e.currentTarget)
  if (idx < 0 || idx === all.length - 1) return
  e.preventDefault()
  all[idx + 1].focus()
}
