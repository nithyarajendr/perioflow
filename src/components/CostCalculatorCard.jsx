import { useState, useMemo } from 'react'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import CostEstimatorPanel from './CostEstimatorPanel'
import { computeCostEstimate, hasCostEstimateData } from '../lib/cost'

/**
 * Patient Cost Calculator banner — the most visually prominent thing on the
 * page after the claim title. Always visible, always shows three big numbers:
 *
 *   Total Fee  |  Est. Reimbursement  |  Est. Out-of-Pocket
 *
 * If no plan details have been entered, the latter two render as "—" with a
 * subtle "Enter plan details to calculate" link that expands the form.
 *
 * Click anywhere on the banner header (or the chevron) to expand the full
 * estimator + math breakdown below.
 */
export default function CostCalculatorCard({
  value, onChange, procedures, cdtCodes, onPrint, initiallyOpen = false,
}) {
  const [expanded, setExpanded] = useState(initiallyOpen)
  const filled = hasCostEstimateData(value)
  const estimate = useMemo(() => computeCostEstimate(procedures || [], value || {}), [procedures, value])
  const Chevron = expanded ? ChevronUp : ChevronDown

  return (
    <div className="rounded-xl border-2 border-teal/40 bg-teal/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full text-left p-5 sm:p-6 hover:bg-teal/10 transition-colors"
      >
        <div className="flex items-start gap-4 mb-4">
          <span className="shrink-0 p-3 rounded-full bg-teal/15 text-teal">
            <Calculator size={26} strokeWidth={1.6} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-xl sm:text-2xl text-text-strong leading-tight">Patient Cost Calculator</h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              {filled
                ? 'Click to view or edit the full breakdown.'
                : 'Calculate the patient\'s estimated out-of-pocket cost based on their plan details.'}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/70 text-teal" aria-hidden="true">
            <Chevron size={18} />
          </span>
        </div>

        {/* Three big numbers — always visible, never collapsed away. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <BannerNumber
            label="Total Fee"
            value={`$${estimate.practiceFeeTotal.toFixed(2)}`}
          />
          <BannerNumber
            label="Est. Reimbursement"
            value={filled ? `$${estimate.finalReimbursement.toFixed(2)}` : '—'}
            tone={filled ? 'success' : 'muted'}
          />
          <BannerNumber
            label="Est. Out-of-Pocket"
            value={filled ? `$${estimate.patientOOP.toFixed(2)}` : '—'}
            tone={filled ? 'navy' : 'muted'}
          />
        </div>

        {!filled && !expanded && (
          <div
            className="mt-3 text-xs sm:text-sm text-teal underline-offset-2 hover:underline inline-flex items-center gap-1"
            // The whole banner is already a button that opens the form, so
            // this is a visual hint rather than a separately-clickable link.
          >
            Enter plan details to calculate →
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-teal/30 bg-white p-5 sm:p-6">
          <CostEstimatorPanel
            procedures={procedures}
            cdtCodes={cdtCodes}
            value={value}
            onChange={onChange}
            onPrint={onPrint}
          />
        </div>
      )}
    </div>
  )
}

function BannerNumber({ label, value, tone = 'navy' }) {
  const tones = {
    navy: 'text-text-strong',
    success: 'text-success',
    muted: 'text-text-muted',
  }
  return (
    <div className="rounded-lg bg-white/70 border border-teal/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">{label}</div>
      <div className={`font-serif text-3xl sm:text-4xl leading-none mt-1.5 tabular-nums ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}
