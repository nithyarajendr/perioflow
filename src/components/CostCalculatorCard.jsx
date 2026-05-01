import { useState } from 'react'
import { Calculator, ChevronDown, ChevronUp, Check } from 'lucide-react'
import CostEstimatorPanel from './CostEstimatorPanel'
import { hasCostEstimateData } from '../lib/cost'

/**
 * Patient Cost Calculator — collapsible card used on both the Claim Detail
 * page and the wizard's Review step. Always visible with a clear header so
 * the user knows the calculator is available for every claim; click the
 * header (or the chevron) to expand the full estimator.
 *
 * Props:
 *   • value, onChange — cost estimate object (mirrors CostEstimatorPanel)
 *   • procedures, cdtCodes — passed through to the panel
 *   • onPrint — optional, only ClaimDetail wires this
 *   • initiallyOpen — wizard auto-opens when a saved estimate already exists
 */
export default function CostCalculatorCard({
  value, onChange, procedures, cdtCodes, onPrint, initiallyOpen = false,
}) {
  const [expanded, setExpanded] = useState(initiallyOpen)
  const filled = hasCostEstimateData(value)
  const Chevron = expanded ? ChevronUp : ChevronDown

  return (
    <div className="rounded-xl border-2 border-teal/40 bg-teal/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full text-left p-5 sm:p-6 hover:bg-teal/10 transition-colors flex items-start gap-4"
      >
        <span className="shrink-0 p-3 rounded-full bg-teal/15 text-teal">
          <Calculator size={26} strokeWidth={1.6} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-serif text-xl sm:text-2xl text-text-strong leading-tight flex items-center gap-2 flex-wrap">
            Patient Cost Calculator
            {filled && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-success bg-success/10 px-2 py-0.5 rounded-full">
                <Check size={10} /> Saved
              </span>
            )}
          </span>
          <span className="block text-sm text-text-muted mt-1.5 max-w-2xl">
            Calculate the patient's estimated out-of-pocket cost based on their plan details.
          </span>
        </span>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/70 text-teal" aria-hidden="true">
          <Chevron size={18} />
        </span>
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
