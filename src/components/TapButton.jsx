import { useTap } from '../lib/useTap'

/**
 * A button that only fires `onTap` on a real tap (not on the start of a
 * scroll). Use this for buttons inside scrollable lists on mobile —
 * payer picker, CDT picker, etc. — where a normal onClick fires the moment
 * the user touches the list to scroll it.
 *
 * Accepts everything a regular <button> takes; the tap handlers are merged
 * in. `touch-action: manipulation` is added by default to disable iOS's
 * legacy 300ms tap delay.
 */
export default function TapButton({ onTap, className = '', children, ...rest }) {
  const tapHandlers = useTap(onTap)
  return (
    <button
      type="button"
      {...tapHandlers}
      className={`touch-manipulation ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
