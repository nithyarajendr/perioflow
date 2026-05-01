import { useMemo } from 'react'
import { AlertTriangle, Info, Printer, Calculator } from 'lucide-react'
import { computeCostEstimate, emptyCostEstimate } from '../lib/cost'

// These number inputs hold 2-5 digit values (deductibles, percentages,
// dollar caps). Keeping them at a reasonable width — full-width looked
// broken with so much trailing whitespace.
const inputCls =
  'w-full max-w-[300px] px-3 py-2 border border-border-warm rounded-md text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal'

// Wrapper around the input + its $ / % decoration. Same max-width as the
// input itself so the badge sits flush to the right edge.
const inputWrapperCls = 'relative w-full max-w-[300px]'

/**
 * CostEstimatorPanel — reusable across:
 *   • New Claim wizard step (Review & Generate)
 *   • Claim Detail page (live recompute from saved cost_estimate + procedures)
 *   • Standalone Cost Calculator page
 *
 * Field order matches the math order below (UCR → deductible → rate →
 * annual max → classification) so the user fills in fields top-to-bottom
 * and the equation reads in the same order.
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
      {/* Inputs — single column, in math order. */}
      <div className="bg-white border border-border-warm rounded-lg p-5">
        <h3 className="font-serif text-xl text-text-strong mb-1">Insurance & Plan Details</h3>
        <p className="text-sm text-text-muted mb-4">Plan-specific numbers from the patient's benefits — used to estimate reimbursement.</p>

        <div className="space-y-5">
          {/* 1. UCR override table — corresponds to step 1 (UCR total). */}
          {procedures.length > 0 && (
            <div className="flex items-start gap-3">
              <StepCircle n="1" className="mt-0.5" />
              <div className="flex-1 min-w-0">
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
            </div>
          )}

          {/* 2. Remaining deductible — step 2 of the math. */}
          <Field step="2" label="Remaining deductible" hint="Amount patient still owes before insurance pays.">
            <div className={inputWrapperCls}>
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

          {/* 3. OON reimbursement rate — step 3 of the math. Made unmistakably
              a percentage input: large teal "%" pill on the right, an
              explicit helper above the input, and a placeholder that names
              the unit. */}
          <Field
            step="3"
            label="Patient's OON reimbursement rate"
            required
            sublabel="Enter as a whole number (e.g. 50 for 50%, 80 for 80%) — get this from the patient's benefits verification call."
            hint="Percentage of UCR the plan pays for out-of-network periodontal procedures."
          >
            <div className={inputWrapperCls}>
              <input
                type="number" min="0" max="100" step="1"
                value={inputs.oon_reimbursement_pct ?? ''}
                onChange={e => update({ oon_reimbursement_pct: e.target.value })}
                disabled={readOnly}
                placeholder="Enter percentage, e.g. 50"
                className={inputCls + ' pr-14'}
              />
              <span className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-teal/15 text-teal font-bold text-base leading-none pointer-events-none">%</span>
            </div>
          </Field>

          {/* 4. Remaining annual max — step 4 of the math (cap). */}
          <Field step="4" label="Remaining annual max" hint="Insurance benefit dollars left for the year. Reimbursement won't exceed this.">
            <div className={inputWrapperCls}>
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

        </div>
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
            {/* Summary bar — visually attached to step 5 with no separator
                so the math leads directly into the answer. Indented so it
                aligns with the step body column above. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
              <SummaryNumber label="Total Fee" value={estimate.practiceFeeTotal} tone="navy" />
              <SummaryNumber label="Insurance Pays" value={estimate.finalReimbursement} tone="success" />
              <SummaryNumber label="Patient Pays" value={estimate.patientOOP} tone="navy" />
            </div>
          </Step>
        </ol>
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

// `step`, when provided, renders a numbered circle to the left of the label
// that exactly matches the step circle in the math breakdown below — that's
// the visual "I entered this number here, watch it show up in step N down
// there" cue the user can trace.
function Field({ label, sublabel, hint, required, step, children }) {
  return (
    <label className="block">
      <div className="flex items-start gap-3">
        {step ? (
          <StepCircle n={step} className="mt-0.5" />
        ) : (
          // Spacer so labelled-without-step rows still align with the input
          // column of stepped rows above/below.
          <span className="shrink-0 w-7" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-text-strong mb-1">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </span>
          {sublabel && <span className="block text-xs text-text-muted mb-1.5">{sublabel}</span>}
          {children}
          {hint && <span className="block text-xs text-text-muted mt-1">{hint}</span>}
        </div>
      </div>
    </label>
  )
}

// The numbered circle used by both Field (input rows) and Step (math
// breakdown rows) so they're visually identical and the user can trace.
function StepCircle({ n, className = '' }) {
  return (
    <span className={`shrink-0 w-7 h-7 rounded-full bg-cream border border-border-warm flex items-center justify-center text-xs font-semibold text-text-muted ${className}`}>
      {n}
    </span>
  )
}

function Step({ n, label, children }) {
  return (
    <li className="flex items-start gap-4">
      <StepCircle n={n} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-0.5">{label}</div>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  )
}

// Same visual treatment as the collapsed Cost Calculator banner at the top
// of the page — keeps the bottom summary feeling like the same UI element.
function SummaryNumber({ label, value, tone = 'navy' }) {
  const tones = {
    navy: 'text-text-strong',
    success: 'text-success',
  }
  return (
    <div className="rounded-lg bg-white border border-teal/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">{label}</div>
      <div className={`font-serif text-3xl sm:text-4xl leading-none mt-1.5 tabular-nums ${tones[tone]}`}>
        ${value.toFixed(2)}
      </div>
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
