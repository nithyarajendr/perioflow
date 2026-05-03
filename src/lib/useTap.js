import { useRef } from 'react'

/**
 * Returns event handlers that fire `onTap` only when the user taps without
 * moving — distinguishes a real tap from the start of a scroll. Critical
 * inside scrollable lists on mobile (payer picker, CDT picker), where naive
 * onClick / onPointerDown handlers fire selections by accident the moment
 * the user touches the list to scroll it.
 *
 * Approach:
 *   • pointerdown — record the touch start position.
 *   • pointerup   — if the finger moved < threshold, fire onTap() and
 *                   suppress the synthetic click so onTap fires exactly
 *                   once. If it moved ≥ threshold, mark this gesture as a
 *                   drag so the trailing click doesn't fire onTap either.
 *   • pointercancel — reset.
 *   • click — only fire onTap when there was no preceding pointer gesture
 *             (i.e. keyboard activation via Enter/Space).
 *
 * Why not rely solely on onClick? Mobile Safari can swallow click when the
 * virtual keyboard dismisses just before the click event would fire (the
 * keyboard-dismiss-eats-click bug). Driving the selection from pointerup
 * sidesteps that.
 *
 * Usage:
 *   const tapHandlers = useTap(() => pickCode(c.code))
 *   <button {...tapHandlers}>...</button>
 */
export function useTap(onTap, { thresholdPx = 10 } = {}) {
  const startRef = useRef(null)
  // 'tap' = pointerup already fired onTap; 'drag' = movement was too large
  // and we deliberately did NOT fire. Either way, the trailing synthetic
  // click should be ignored. null = no pointer gesture in flight, so a
  // bare click event must be from keyboard activation.
  const handledRef = useRef(null)

  return {
    onPointerDown: (e) => {
      startRef.current = { x: e.clientX, y: e.clientY }
      handledRef.current = null
    },
    onPointerUp: (e) => {
      const start = startRef.current
      startRef.current = null
      if (!start) return
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (moved < thresholdPx) {
        handledRef.current = 'tap'
        e.preventDefault()
        onTap()
      } else {
        handledRef.current = 'drag'
      }
    },
    onPointerCancel: () => {
      startRef.current = null
      handledRef.current = 'drag'
    },
    onClick: () => {
      if (handledRef.current) {
        handledRef.current = null
        return
      }
      // No preceding pointer gesture — must be keyboard activation.
      onTap()
    },
  }
}
