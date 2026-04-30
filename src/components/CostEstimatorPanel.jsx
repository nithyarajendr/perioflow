import { useMemo } from 'react'
import { AlertTriangle, Info, Printer, Calculator } from 'lucide-react'
import { computeCostEstimate, PERIO_CLASSIFICATIONS, emptyCostEstimate } from '../lib/cost'

const inputCls =
  'w-full px-3 py-2 border border-border-warm rounded-md text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal'

/**
 * CostEstimatorPanel — reusable across:
 *   • New Claim wizard step (between Procedures and Clinical Findings)
 *   • Claim Detail page (live recompute from saved cost_estimate + procedures)
 *   • Standalone Cost Estimator page
 *
 * Props:
 *   procedures        — [{ cdt_code, fee, ... }] (required)
 *   cdtCodes          — full CDT code list (for descriptions)
 *   value             — current cost_estimate object
 *   onChange          — (next) => void; receives full cost_estimate
 *   onPrint           — (estimate) => void; optional, opens print PDF
 *   readOnly          — disable inputs (e.g. submitted claims)
 */
export default function CostEstimatorPanel({ procedures = [], cdtCodes = [], value, onChange, onPrint, readOnly = false }) {
  const inputs = value || emptyCostEstimate()
  const estimate = useMemo(() => computeCostEstimate(procedures, inputs), [procedures, inputs])

  const update = (patch) => {
    if (readOnly) return
    onChange?.({ ...inputs, ...patch })
  }
  const updateUcr = (code, val) => {
    update({ ucr_per_code: { ...(inputs.ucr_per_code || {}), [code]: val } })
  }

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="bg-white border border-border-warm rounded-lg p-5">
        <h3 className="font-serif text-xl text-text-strong mb-1">Insurance & Plan Details</h3>
        <p className="text-sm text-text-muted mb-4">Plan-specific numbers from the patient's benefits — used to estimate reimbursement.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Patient's OON reimbursement rate" required hint="Percentage of UCR the plan pays for out-of-network periodontal procedures.">
            <div className="relative">
              <input
                type="number" min="0" max="100" step="1"
                value={inputs.oon_reimbursement_pct ?? ''}
                onChange={e => update({ oon_reimbursement_pct: e.target.value })}
                disabled={readOnly}
                placeholder="e.g., 50"
                className={inputCls + ' pr-7'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
            </div>
          </Field>

          <Field label="Remaining deductible" hint="Amount patient still owes before insurance pays.">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
              <input
                type="number" min="0" step="1"
                value={inputs.remaining_deductible ?? ''}
                onChange={e => update({ remaining_deductible: e.target.value })}
                disabled={readOnly}
                placeholder="0"
                className={inputCls + ' pl-7'}
              />
            </div>
          </Field>

          <Field label="Remaining annual max" hint="Insurance benefit dollars left for the year. Reimbursement won't exceed this.">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
              <input
                type="number" min="0" step="1"
                value={inputs.remaining_annual_max ?? ''}
                onChange={e => update({ remaining_annual_max: e.target.value })}
                disabled={readOnly}
                placeholder="e.g., 2000"
                className={inputCls + ' pl-7'}
              />
            </div>
          </Field>

          <Field label="How does this plan classify periodontal procedures?" hint="Major vs basic can change reimbursement significantly.">
            <select
              value={inputs.perio_classification || 'unknown'}
              onChange={e => update({ perio_classification: e.target.value })}
              disabled={readOnly}
              className={inputCls}
            >
              {PERIO_CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>

        {procedures.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-text-strong mb-1">Payer's usual & customary rate per procedure (UCR)</h4>
            <p className="text-xs text-text-muted mb-3">Optional — leave blank to use the practice fee as the UCR.</p>
            <div className="border border-border-warm rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream-light text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left w-24">Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right w-28">Practice Fee</th>
                    <th className="px-3 py-2 text-right w-32">UCR (override)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-warm">
                  {procedures.map((p, idx) => {
                    const cdt = cdtCodes.find(c => c.code === p.cdt_code)
                    const ucrVal = inputs.ucr_per_code?.[p.cdt_code] ?? ''
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-mono text-text-strong">{p.cdt_code || '—'}</td>
                        <td className="px-3 py-2 text-text-muted truncate max-w-md">{cdt?.description || '—'}</td>
                        <td className="px-3 py-2 text-right text-text-strong">${(Number(p.fee) || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={ucrVal}
                              onChange={e => updateUcr(p.cdt_code, e.target.value)}
                              disabled={readOnly}
                              placeholder={(Number(p.fee) || 0).toString()}
                              className="w-full pl-5 pr-2 py-1 border border-border-warm rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown — explicit Step 1–5 math so staff can read it to the patient. */}
      <div className="bg-white border border-border-warm rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="font-serif text-xl text-text-strong flex items-center gap-2">
            <Calculator size={18} className="text-teal" />
            Estimated breakdown
          </h3>
          {onPrint && (
            <button
              onClick={() => onPrint(estimate)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-warm rounded-full text-sm text-text-strong hover:bg-cream-light"
            >
              <Printer size={14} /> Print Estimate
            </button>
          )}
        </div>

        <ol className="space-y-4">
          <Step n="1" label="UCR total">
            <div className="text-text-strong">${estimate.ucrTotal.toFixed(2)}</div>
          </Step>

          <Step n="2" label="Less remaining deductible">
            <div className="text-text-strong">
              <span className="font-mono">${estimate.ucrTotal.toFixed(2)} − ${estimate.remainingDeductible.toFixed(2)}</span>
              {' = '}<strong>${estimate.eligibleAmount.toFixed(2)} eligible</strong>
            </div>
            {estimate.deductibleConsumesAll && (
              <div className="text-xs text-warning mt-1">Deductible consumes the full UCR — no eligible amount this claim.</div>
            )}
          </Step>

          <Step n="3" label="Eligible × reimbursement rate">
            <div className="text-text-strong">
              <span className="font-mono">${estimate.eligibleAmount.toFixed(2)} × {estimate.reimbursementPctRaw}%</span>
              {' = '}<strong>${estimate.grossReimbursement.toFixed(2)} gross reimbursement</strong>
            </div>
          </Step>

          <Step n="4" label="Annual max check">
            {estimate.annualMaxApplied ? (
              <div className="text-text-strong">
                <span className="font-mono">${estimate.grossReimbursement.toFixed(2)}</span> exceeds remaining annual max{' '}
                <span className="font-mono">${estimate.annualMaxValue.toFixed(2)}</span>{' '}— <strong>capped at ${estimate.annualMaxValue.toFixed(2)}</strong>
              </div>
            ) : estimate.hasAnnualMax ? (
              <div className="text-text-muted">
                Under remaining annual max (${estimate.annualMaxValue.toFixed(2)}) — no cap applied.
              </div>
            ) : (
              <div className="text-text-muted">No annual max entered — no cap applied.</div>
            )}
          </Step>

          <Step n="5" label="Patient out-of-pocket">
            <div className="text-text-strong">
              Practice fee <span className="font-mono">${estimate.practiceFeeTotal.toFixed(2)}</span>
              {' '}− Estimated reimbursement <span className="font-mono">${estimate.finalReimbursement.toFixed(2)}</span>
              {' = '}<strong>${estimate.patientOOP.toFixed(2)} out-of-pocket</strong>
            </div>
          </Step>
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t-2 border-border-warm">
          <SummaryCard
            label="Estimated reimbursement"
            value={estimate.finalReimbursement}
            tint="success"
          />
          <SummaryCard
            label="Estimated patient out-of-pocket"
            value={estimate.patientOOP}
            tint="navy"
          />
        </div>
      </div>

      {/* Warnings */}
      {estimate.warnings.length > 0 && (
        <div className="space-y-2">
          {estimate.warnings.map((w, i) => (
            <Warning key={i} {...w} />
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-strong mb-1">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-text-muted mt-1">{hint}</span>}
    </label>
  )
}

function Step({ n, label, children }) {
  return (
    <li className="flex items-start gap-4">
      <span className="shrink-0 w-7 h-7 rounded-full bg-cream border border-border-warm flex items-center justify-center text-xs font-semibold text-text-muted">
        {n}
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-0.5">{label}</div>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  )
}

function SummaryCard({ label, value, tint }) {
  const tints = {
    success: 'bg-success/10 border-success/40 text-success',
    navy: 'bg-navy/5 border-navy/30 text-text-strong',
  }
  return (
    <div className={`rounded-lg border p-4 ${tints[tint] || tints.navy}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="font-serif text-3xl mt-1 leading-tight">${value.toFixed(2)}</div>
    </div>
  )
}

function Warning({ level, text }) {
  const cls = level === 'warning'
    ? 'border-warning/40 bg-warning/10 text-yellow-800'
    : 'border-border-warm bg-cream-light text-text-strong'
  const Icon = level === 'warning' ? AlertTriangle : Info
  return (
    <div className={`flex items-start gap-2 p-3 rounded-md border ${cls}`}>
      <Icon size={16} className={`shrink-0 mt-0.5 ${level === 'warning' ? 'text-warning' : 'text-text-muted'}`} />
      <span className="text-sm">{text}</span>
    </div>
  )
}
