import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Block in-app navigation and tab close when `isDirty` is true.
 *
 * Returns the React Router blocker so the caller can render a confirmation
 * modal when `blocker.state === 'blocked'`. The caller is responsible for
 * rendering UI and calling `blocker.proceed()` / `blocker.reset()`.
 *
 * Tab close / reload triggers the browser-native confirm via `beforeunload` —
 * the message text is not customizable by spec.
 *
 * Pass `bypassRef` (a `useRef(false)`) to opt out of the guard for an
 * intentional navigation (e.g. delete-then-navigate-home). Setting
 * `bypassRef.current = true` synchronously before navigate() suppresses the
 * block without waiting for a re-render.
 *
 * Requires the app to use a data router (`createBrowserRouter`); `useBlocker`
 * is a no-op under the legacy `<BrowserRouter>`.
 */
export function useUnsavedChangesGuard(isDirty, bypassRef) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      if (bypassRef?.current) return false
      return isDirty && currentLocation.pathname !== nextLocation.pathname
    }
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  return blocker
}
