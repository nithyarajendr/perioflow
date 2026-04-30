import { useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { formatDate, formatMoney } from '../lib/utils'

export default function PrintView({ open, onClose, claim, payer, settings, cdtCodes }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const checklistItems = claim.checklist || []
  const cdtFor = (code) => cdtCodes.find(c => c.code === code)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4 print-overlay">
      <div className="bg-white max-w-3xl w-full rounded-lg shadow-xl my-8 print-sheet">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 no-print">
          <div className="text-sm font-medium text-text-strong">Claim Packet — Preview</div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy text-white rounded-md text-sm hover:opacity-90">
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-text-strong p-1" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-8 py-8 print-content text-text-strong">
          <header className="border-b-2 border-navy pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold">{settings?.practice_name || 'Practice Name'}</h1>
                <p className="text-sm text-text-muted">{settings?.practice_address}</p>
                <p className="text-sm text-text-muted">{settings?.practice_phone}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-semibold">Insurance Claim Documentation</h2>
                <p className="text-xs text-text-muted">Generated {formatDate(new Date())}</p>
                <p className="text-xs text-text-muted">Claim ID: <span className="font-mono">{claim.claim_id}</span></p>
              </div>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div><span className="font-medium">Patient:</span> {claim.patient_name || '—'}</div>
            <div><span className="font-medium">Date of Service:</span> {formatDate(claim.date_of_service)}</div>
            <div><span className="font-medium">Payer:</span> {payer?.name || claim.payer_id || '—'}</div>
            <div><span className="font-medium">Plan Type:</span> {payer?.plan_type || '—'}</div>
            <div><span className="font-medium">Provider:</span> {settings?.provider_name || '—'}</div>
          </section>

          <section className="mb-6">
            <h3 className="font-semibold border-b border-gray-300 pb-1 mb-2">Procedures</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-1">CDT Code</th>
                  <th className="py-1">Description</th>
                  <th className="py-1">Quadrant / Teeth</th>
                  <th className="py-1 text-right">Fee</th>
                </tr>
              </thead>
              <tbody>
                {claim.procedures.map((p, i) => {
                  const cdt = cdtFor(p.cdt_code)
                  const loc = (p.quadrants?.length ? p.quadrants.join(', ') : null) || p.tooth_numbers || '—'
                  return (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="py-2 font-mono">{p.cdt_code}</td>
                      <td className="py-2">{cdt?.description || '—'}</td>
                      <td className="py-2">{loc}</td>
                      <td className="py-2 text-right">{formatMoney(p.fee)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className="py-2 text-right font-semibold">Total</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(claim.total_fee)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="mb-6">
            <h3 className="font-semibold border-b border-gray-300 pb-1 mb-2">Clinical Narrative</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{claim.generated_narrative || '(No narrative provided.)'}</p>
          </section>

          <section className="mb-6">
            <h3 className="font-semibold border-b border-gray-300 pb-1 mb-2">Attachments</h3>
            <p className="text-sm text-text-muted mb-2">The following documents are enclosed with this claim:</p>
            {checklistItems.length === 0 ? (
              <p className="text-sm text-text-muted italic">No items checked.</p>
            ) : (
              <ul className="text-sm list-disc pl-5 space-y-1">
                {checklistItems.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
          </section>

          <footer className="text-xs text-text-muted text-center border-t border-gray-200 pt-3 mt-8">
            {settings?.practice_name || 'PerioFlow Demo Practice'} — Generated by PerioFlow
          </footer>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-overlay, .print-overlay * { visibility: visible !important; }
          .print-overlay { position: absolute !important; inset: 0 !important; background: white !important; padding: 0 !important; overflow: visible !important; }
          .print-sheet { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-content { padding: 0.5in !important; }
        }
      `}</style>
    </div>
  )
}
