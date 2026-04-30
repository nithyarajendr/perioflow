import { useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { computeCostEstimate } from '../lib/cost'
import { formatDate } from '../lib/utils'

/**
 * Patient-facing cost estimate. Same print/preview pattern as PrintView.
 * Designed to be handed to or emailed to the patient — plain language, no
 * insurance jargon beyond what's necessary.
 */
export default function CostEstimatePrintView({ open, onClose, patientName, procedures, costEstimate, settings, cdtCodes, payerName }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const estimate = computeCostEstimate(procedures || [], costEstimate || {})
  const procRows = (procedures || []).map((p, i) => {
    const cdt = cdtCodes?.find(c => c.code === p.cdt_code)
    return { ...p, description: cdt?.description || '', ucr: estimate.ucrPerProc[i] }
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4 print-overlay">
      <div className="bg-white max-w-3xl w-full rounded-lg shadow-xl my-8 print-sheet">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-warm no-print">
          <div className="text-sm font-medium text-text-strong">Patient Cost Estimate — Preview</div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy text-cream-light rounded-md text-sm hover:opacity-90">
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
                <h1 className="font-serif text-2xl">{settings?.practice_name || 'Practice Name'}</h1>
                <p className="text-sm text-text-muted">{settings?.practice_address}</p>
                <p className="text-sm text-text-muted">{settings?.practice_phone}</p>
              </div>
              <div className="text-right">
                <h2 className="font-serif text-xl">Cost Estimate</h2>
                <p className="text-xs text-text-muted">Generated {formatDate(new Date())}</p>
              </div>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {patientName && <div><span className="font-medium">Patient:</span> {patientName}</div>}
            {payerName && <div><span className="font-medium">Insurance plan:</span> {payerName}</div>}
            {settings?.provider_name && <div><span className="font-medium">Provider:</span> {settings.provider_name}</div>}
          </section>

          <section className="mb-6">
            <h3 className="font-serif text-lg border-b border-gray-300 pb-1 mb-2">Procedures planned</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-1">CDT</th>
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Practice fee</th>
                  <th className="py-1 text-right">UCR</th>
                </tr>
              </thead>
              <tbody>
                {procRows.map((p, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-2 font-mono">{p.cdt_code}</td>
                    <td className="py-2">{p.description}</td>
                    <td className="py-2 text-right">${(Number(p.fee) || 0).toFixed(2)}</td>
                    <td className="py-2 text-right">${p.ucr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={2} className="py-2 text-right font-semibold">Total</td>
                  <td className="py-2 text-right font-semibold">${estimate.practiceFeeTotal.toFixed(2)}</td>
                  <td className="py-2 text-right font-semibold">${estimate.ucrTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="mb-6">
            <h3 className="font-serif text-lg border-b border-gray-300 pb-1 mb-3">How we calculated your estimate</h3>
            <ol className="space-y-2 text-sm leading-relaxed list-decimal pl-5">
              <li>The total fee for these procedures is <strong>${estimate.practiceFeeTotal.toFixed(2)}</strong>.</li>
              <li>Your insurance plan considers the usual & customary rate (UCR) to be <strong>${estimate.ucrTotal.toFixed(2)}</strong>.</li>
              <li>Your plan reimburses <strong>{estimate.reimbursementPctRaw}%</strong> of the UCR, which is <strong>${estimate.grossReimbursement.toFixed(2)}</strong>.</li>
              {estimate.remainingDeductible > 0 && (
                <li>You still owe <strong>${estimate.remainingDeductible.toFixed(2)}</strong> on your annual deductible. After deductible: <strong>${estimate.afterDeductible.toFixed(2)}</strong>.</li>
              )}
              {estimate.hasAnnualMax && estimate.annualMaxApplied && (
                <li>Your remaining annual maximum is <strong>${estimate.annualMaxValue.toFixed(2)}</strong>, which caps reimbursement.</li>
              )}
              <li><strong>Estimated reimbursement from insurance: ${estimate.finalReimbursement.toFixed(2)}</strong></li>
              <li><strong>Estimated patient out-of-pocket: ${estimate.patientOOP.toFixed(2)}</strong></li>
            </ol>
          </section>

          <section className="mb-6 text-sm bg-cream-light border border-border-warm rounded-md p-4">
            <strong>This is an estimate, not a guarantee of payment.</strong> Actual reimbursement is determined by your insurance after the claim is reviewed. We will submit the claim on your behalf and provide updates as they come in.
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
