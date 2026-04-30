import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Three-button confirmation shown when the user tries to navigate away from a
 * form with unsaved edits. Driven by a React Router blocker passed in by the
 * caller. The caller owns the save logic — pass `onSave` returning a Promise.
 */
export default function UnsavedChangesDialog({ blocker, onSave, onSaveError }) {
  const [saving, setSaving] = useState(false)

  if (!blocker || blocker.state !== 'blocked') return null

  const handleSaveAndLeave = async () => {
    setSaving(true)
    try {
      await onSave()
      blocker.proceed()
    } catch (err) {
      // Don't navigate on save failure — keep the modal open so the user
      // can retry or discard. Surface a toast via the caller if provided.
      onSaveError?.(err)
    } finally {
      setSaving(false)
    }
  }
  const handleDiscardAndLeave = () => blocker.proceed()
  const handleCancel = () => blocker.reset()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-warning/10 text-yellow-700">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-strong">You have unsaved changes</h3>
            <p className="text-sm text-text-muted mt-1">Save before leaving?</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-text-muted border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDiscardAndLeave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-md bg-danger hover:opacity-90 disabled:opacity-50"
          >
            Discard & Leave
          </button>
          <button
            onClick={handleSaveAndLeave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md bg-navy hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save & Leave'}
          </button>
        </div>
      </div>
    </div>
  )
}
