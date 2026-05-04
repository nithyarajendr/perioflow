import { useId, useRef, useState } from 'react'
import TapButton from './TapButton'

/**
 * A text input with a custom suggestions dropdown, replacing HTML5
 * <datalist>. Datalist on iOS Safari shows suggestions in the QuickType
 * keyboard bar instead of as a floating menu, which is inconsistent with
 * how it renders on desktop and mixes with the OS's previously-typed
 * suggestions. This component renders a real floating dropdown anchored
 * below the input, the same way the payer + CDT pickers work elsewhere.
 *
 * `autoComplete="off"` and a unique `name` are set automatically so iOS
 * Safari doesn't show its own QuickType bar of previously-typed values
 * over our dropdown.
 *
 * Props:
 *   • value, onChange  — controlled input
 *   • suggestions      — array of strings
 *   • placeholder, className, onKeyDown — passed through to the input
 *   • inputClassName   — class for the input element itself
 */
export default function AutocompleteInput({
  value, onChange, suggestions = [], placeholder, className = '', inputClassName = '', onKeyDown, ...rest
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const blurTimer = useRef(null)

  const filtered = (() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return suggestions.slice(0, 8)
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8)
  })()

  // Defer the blur close so a TapButton click inside the dropdown still
  // gets to fire onTap before the dropdown unmounts.
  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setOpen(false), 150)
  }
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setOpen(true)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        name={`ac-${id}`}
        className={inputClassName}
        {...rest}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-border-warm rounded-md shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
          {filtered.map(s => (
            <TapButton
              key={s}
              onTap={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-cream-light text-sm text-text-strong"
            >
              {s}
            </TapButton>
          ))}
        </div>
      )}
    </div>
  )
}
