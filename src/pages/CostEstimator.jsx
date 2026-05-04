import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '../lib/DataContext'
import CostEstimatorPanel from '../components/CostEstimatorPanel'
import CostEstimatePrintView from '../components/CostEstimatePrintView'
import { emptyCostEstimate } from '../lib/cost'
import { enterToNextField } from '../lib/formHelpers'

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
  const id = useId()

  const [sourceClaimId, setSourceClaimId] = useState('')
  const [patient, setPatient] = useState('')
  const [payer, setPayer] = useState('')
  const [procedures, setProcedures] = useState([{ cdt_code: '', fee: '' }])
  const [estimate, setEstimate] = useState(emptyCostEstimate())
  const [printOpen, setPrintOpen] = useState(false)

  const sourceClaim = useMemo(
    () => claims.find(c => c.claim_id === sourceClaimId),
    [claims, sourceClaimId]
  )

  // When the user picks an existing claim, copy its procedures + cost
  // estimate into the editable state. This is a *pre-fill*, not a
  // read-only view: the fields stay fully editable so the user can run
  // what-ifs without affecting the source claim.
  useEffect(() => {
    if (!sourceClaim) return
    setProcedures(sourceClaim.procedures?.length
      ? sourceClaim.procedures.map(p => ({ ...p }))
      : [{ cdt_code: '', fee: '' }])
    setEstimate(sourceClaim.cost_estimate || emptyCostEstimate())
    setPatient(sourceClaim.patient_name || '')
    setPayer(sourceClaim.payer_id || '')
  }, [sourceClaim])

  const payerName = payers.find(p => p.payer_id === payer)?.name || ''

  const updateProc = (idx, patch) => {
    setProcedures(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const pickCode = (idx, code) => {
    const fee = getFeeForCode(code)
    updateProc(idx, { cdt_code: code, fee: fee != null ? String(fee) : '' })
  }
  const addProc = () => setProcedures(r => [...r, { cdt_code: '', fee: '' }])
  const removeProc = (idx) => setProcedures(r => r.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="font-serif text-3xl text-text-strong">Cost Calculator</h1>
        <p className="text-text-muted mt-1">
          Quick patient-facing estimate — no AI, just math. Use this for phone inquiries or new-patient consults.
        </p>
      </header>

      {/* Source picker — pre-fill from an existing draft, or build from scratch.
           Selecting an existing claim copies its values into the editable
           state below; the user can then run what-ifs without affecting
           the source claim. */}
      <section className="bg-white border border-border-warm rounded-lg p-5">
        <h2 className="font-serif text-xl text-text-strong mb-3">Start from</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-text-strong mb-1">Existing claim (optional)</span>
            <select className={inputCls} value={sourceClaimId} onChange={e => setSourceClaimId(e.target.value)} name={`${id}-source`}>
              <option value="">— Build from scratch —</option>
              {claims.map(c => (
                <option key={c.claim_id} value={c.claim_id}>
                  {c.claim_id} · {c.patient_name || 'Untitled'} · {payers.find(p => p.payer_id === c.payer_id)?.name || c.payer_id}
                </option>
              ))}
            </select>
            {sourceClaim && (
              <span className="block text-xs text-text-muted mt-1">
                Pre-filled from <span className="font-mono">{sourceClaim.claim_id}</span>. All fields below are editable — changes here don't affect the saved claim.
              </span>
            )}
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-text-strong mb-1">Patient (optional)</span>
            <input
              className={inputCls}
              placeholder="Patient ID or initials"
              value={patient}
              onChange={e => setPatient(e.target.value)}
              onKeyDown={enterToNextField}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              name={`${id}-patient`}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="block text-sm font-medium text-text-strong mb-1">Insurance plan (optional)</span>
            <select className={inputCls} value={payer} onChange={e => setPayer(e.target.value)} name={`${id}-plan`}>
              <option value="">— Select a payer —</option>
              {payers.map(p => <option key={p.payer_id} value={p.payer_id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="bg-white border border-border-warm rounded-lg p-5">
        <h2 className="font-serif text-xl text-text-strong mb-3">Procedures</h2>
        <div className="space-y-2">
          {procedures.map((p, i) => (
            <AdHocProcRow
              key={i}
              proc={p}
              cdtCodes={cdtCodes}
              onPickCode={code => pickCode(i, code)}
              onChangeFee={fee => updateProc(i, { fee })}
              onRemove={procedures.length > 1 ? () => removeProc(i) : null}
            />
          ))}
          <button onClick={addProc} className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
            <Plus size={16} /> Add procedure
          </button>
        </div>
      </section>

      <CostEstimatorPanel
        procedures={procedures}
        cdtCodes={cdtCodes}
        value={estimate}
        onChange={setEstimate}
        onPrint={() => setPrintOpen(true)}
      />

      <p className="text-xs text-text-muted">
        Need to save this estimate? Create a claim from{' '}
        <Link to="/new-claim" className="text-teal underline underline-offset-2 hover:text-teal/80">New Claim</Link>
        {' '}— the calculator is built into the wizard and saves with the claim.
      </p>

      <CostEstimatePrintView
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        patientName={patient}
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
  const id = useId()
  // Stack on mobile (each field full width) so the CDT dropdown isn't cut
  // off on narrow viewports; row layout on sm+ where there's space.
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center">
      <select
        className={inputCls + ' sm:col-span-7 font-mono'}
        value={proc.cdt_code || ''}
        onChange={e => onPickCode(e.target.value)}
        name={`${id}-cdt`}
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
          onKeyDown={enterToNextField}
          placeholder="Fee"
          className={inputCls + ' pl-7'}
          autoComplete="off"
          spellCheck="false"
          inputMode="decimal"
          name={`${id}-fee`}
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
