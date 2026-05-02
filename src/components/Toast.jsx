import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const show = useCallback((message, type = 'info') => {
    const id = ++counter
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} {...t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ message, type, onClose }) {
  // Fully opaque backgrounds with white text — readable against any page
  // background, no translucency. Each type uses its own brand color.
  const styles = {
    success: 'bg-success text-white border-success',
    error:   'bg-danger text-white border-danger',
    info:    'bg-navy text-white border-navy',
    warning: 'bg-warning text-white border-warning',
  }
  const Icon = type === 'error' ? AlertCircle : CheckCircle2
  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-md border shadow-lg ${styles[type] || styles.info}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 text-sm leading-snug font-medium">{message}</div>
      <button onClick={onClose} className="opacity-80 hover:opacity-100" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { show: () => {} }
  return ctx
}
