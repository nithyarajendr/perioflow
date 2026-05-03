import { useState, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '../lib/DataContext'
import CostEstimatorPanel from '../components/CostEstimatorPanel'
import CostEstimatePrintView from '../components/CostEstimatePrintView'
import { emptyCostEstimate } from '../lib/cost'

// text-base (16px) on the input itself prevents iOS Safari from auto-zooming
// the page when the field gains focus.
const inputCls =
  'w-full px-3 py-2 border border-border-warm rounded-md text-base bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal'

/**
 * Standalone "Cost Estimator" page — for quick what-ifs without creating a draft claim.
 *
 * Staff can either start from an existing draft (loads its procedures and any
 * saved cost_estimate) or build an ad-hoc set of procedures + plan inputs.
 */
export default function CostEstimator() {
  const { claims, cdtCodes, payers, getFeeForCode, settings } = useData()

  const [sourceClaimId, setSourceClaimId] = useState('')
  const [adHocPatient, setAdHocPatient] = useState('')
  const [adHocPayer, setAdHocPayer] = useState('')
  const [adHocProcedures, setAdHocProcedures] = useState([{ cdt_code: '', fee: '' }])
  const [adHocEstimate, setAdHocEstimate] = useState(emptyCostEstimate())
  const [printOpen, setPrintOpen] = useState(false)

  const sourceClaim = useMemo(
    () => claims.find(c => c.claim_id === sourceClaimId),
    [claims, sourceClaimId]
  )

  // Effective procedures + estimate inputs:
  //   • If a source claim is selected → use its procedures + saved cost_estimate.
  //   • Otherwise → use the ad-hoc state.
  const procedures = sourceClaim ? sourceClaim.procedures : adHocProcedures
  const estimate = sourceClaim ? (sourceClaim.cost_estimate || emptyCostEstimate()) : adHocEstimate
  const setEstimate = sourceClaim ? () => {} : setAdHocEstimate
  const patientName = sourceClaim ? sourceClaim.patient_name : adHocPatient
  const payerId = sourceClaim ? sourceClaim.payer_id : adHocPayer
  const payerName = payers.find(p => p.payer_id === payerId)?.name || ''

  const updateAdHocProc = (idx, patch) => {
    setAdHocProcedures(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const pickAdHocCode = (idx, code) => {
    const fee = getFeeForCode(code)
    updateAdHocProc(idx, { cdt_code: code, fee: fee != null ? String(fee) : '' })
  }
  const addAdHocProc = () => setAdHocProcedures(r => [...r, { cdt_code: '', fee: '' }])
  const removeAdHocProc = (idx) => setAdHocProcedures(r => r.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="font-serif text-3xl text-text-strong">Cost Calculator</h1>
        <p className="text-text-muted mt-1">
          Quick patient-facing estimate — no AI, just math. Use this for phone inquiries or new-patient consults.
        </p>
      </header>

      {/* Source picker — load from an existing draft, or build ad-hoc. */}
      <section className="bg-white border border-border-warm rounded-lg p-5">
        <h2 className="font-serif text-xl text-text-strong mb-3">Start from</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-text-strong mb-1">Existing claim (optional)</span>
            <select className={inputCls} value={sourceClaimId} onChange={e => setSourceClaimId(e.target.value)}>
              <option value="">— Build ad-hoc —</option>
              {claims.map(c => (
                <option key={c.claim_id} value={c.claim_id}>
                  {c.claim_id} · {c.patient_name || 'Untitled'} · {payers.find(p => p.payer_id === c.payer_id)?.name || c.payer_id}
                </option>
              ))}
            </select>
          </label>
          {!sourceClaim && (
            <label className="block">
              <span className="block text-sm font-medium text-text-strong mb-1">Patient (optional)</span>
              <input
                className={inputCls}
                placeholder="Patient ID or initials"
                value={adHocPatient}
                onChange={e => setAdHocPatient(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
              />
            </label>
          )}
          {!sourceClaim && (
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-text-strong mb-1">Insurance plan (optional)</span>
              <select className={inputCls} value={adHocPayer} onChange={e => setAdHocPayer(e.target.value)}>
                <option value="">— Select a payer —</option>
                {payers.map(p => <option key={p.payer_id} value={p.payer_id}>{p.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </section>

      {/* Ad-hoc procedures (only shown when not viewing an existing claim). */}
      {!sourceClaim && (
        <section className="bg-white border border-border-warm rounded-lg p-5">
          <h2 className="font-serif text-xl text-text-strong mb-3">Procedures</h2>
          <div className="space-y-2">
            {adHocProcedures.map((p, i) => (
              <AdHocProcRow
                key={i}
                proc={p}
                cdtCodes={cdtCodes}
                onPickCode={code => pickAdHocCode(i, code)}
                onChangeFee={fee => updateAdHocProc(i, { fee })}
                onRemove={adHocProcedures.length > 1 ? () => removeAdHocProc(i) : null}
              />
            ))}
            <button onClick={addAdHocProc} className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
              <Plus size={16} /> Add procedure
            </button>
          </div>
        </section>
      )}

      <CostEstimatorPanel
        procedures={procedures}
        cdtCodes={cdtCodes}
        value={estimate}
        onChange={setEstimate}
        onPrint={sourceClaim ? null : () => setPrintOpen(true)}
        readOnly={!!sourceClaim}
      />

      {!sourceClaim && (
        <p className="text-xs text-text-muted">
          Need to save this estimate? Create a claim from <strong>New Claim</strong> — the estimator is built into the wizard and saves with the claim.
        </p>
      )}
      {sourceClaim && (
        <p className="text-xs text-text-muted">
          Viewing the saved estimate from <span className="font-mono">{sourceClaim.claim_id}</span>. Edit it on the claim's detail page.
        </p>
      )}

      <CostEstimatePrintView
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        patientName={patientName}
        procedures={procedures}
        costEstimate={estimate}
        settings={settings}
        cdtCodes={cdtCodes}
        payerName={payerName}
      />
    </div>
  )
}

function AdHocProcRow({ proc, cdtCodes, onPickCode, onChangeFee, onRemove }) {
  // Stack on mobile (each field full width) so the CDT dropdown isn't cut
  // off on narrow viewports; row layout on sm+ where there's space.
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center">
      <select
        className={inputCls + ' sm:col-span-7 font-mono'}
        value={proc.cdt_code || ''}
        onChange={e => onPickCode(e.target.value)}
      >
        <option value="">— Select a CDT code —</option>
        {cdtCodes.map(c => (
          <option key={c.code} value={c.code}>{c.code} — {c.description}</option>
        ))}
      </select>
      <div className="sm:col-span-4 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
        <input
          type="number" min="0" step="0.01"
          value={proc.fee || ''}
          onChange={e => onChangeFee(e.target.value)}
          placeholder="Fee"
          className={inputCls + ' pl-7'}
          autoComplete="off"
          inputMode="decimal"
        />
      </div>
      <div className="sm:col-span-1 flex justify-end">
        {onRemove && (
          <button onClick={onRemove} className="p-2 text-text-muted hover:text-danger" aria-label="Remove">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
