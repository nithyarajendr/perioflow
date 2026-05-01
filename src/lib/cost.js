// Pure-math cost-estimator. NO AI. No external state. Same inputs → same outputs.
//
// CALCULATION ORDER (must match spec exactly):
//   Step 1  UCR total = Σ ucr per procedure  (UCR defaults to practice fee if unset)
//   Step 2  Eligible amount = max(0, UCR total − remaining deductible)
//   Step 3  Gross reimbursement = eligible amount × reimbursement %
//   Step 4  Final reimbursement = min(gross reimbursement, remaining annual max)
//   Step 5  Patient out-of-pocket = practice fee total − final reimbursement
//
// Inputs object (cost_estimate stored on the claim):
//   {
//     oon_reimbursement_pct: number | string,   // 0–100
//     ucr_per_code: { [cdt_code: string]: number | string },  // optional, blank = use practice fee
//     remaining_deductible: number | string,    // default 0
//     remaining_annual_max: number | string,    // blank = no cap
//     perio_classification: 'basic' | 'major' | 'unknown',
//   }

export const PERIO_CLASSIFICATIONS = [
  { value: 'major', label: 'Major (typically 50% reimbursement)' },
  { value: 'basic', label: 'Basic (typically 80% reimbursement)' },
  { value: 'unknown', label: 'Unknown' },
]

const HIGH_FEE_REVIEW_THRESHOLD = 2500

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function computeCostEstimate(procedures, inputs) {
  const procs = procedures || []
  const i = inputs || {}

  // Practice fee = sum of fee fields on each procedure row.
  const practiceFeeTotal = procs.reduce((s, p) => s + num(p.fee, 0), 0)

  // Per-procedure UCR — falls back to the practice fee for any code without a UCR set.
  const ucrPerProc = procs.map(p => {
    const explicit = i.ucr_per_code?.[p.cdt_code]
    if (explicit !== undefined && explicit !== null && explicit !== '') return num(explicit, 0)
    return num(p.fee, 0)
  })

  // STEP 1 — UCR total
  const ucrTotal = ucrPerProc.reduce((s, x) => s + x, 0)

  // STEP 2 — Subtract remaining deductible from UCR total. Clamp at 0.
  const remainingDeductible = Math.max(0, num(i.remaining_deductible, 0))
  const eligibleAmount = Math.max(0, ucrTotal - remainingDeductible)
  const deductibleConsumesAll = remainingDeductible >= ucrTotal && ucrTotal > 0

  // STEP 3 — Multiply eligible amount by reimbursement percentage.
  const reimbursementPctRaw = num(i.oon_reimbursement_pct, 0)
  const reimbursementPct = reimbursementPctRaw / 100
  const grossReimbursement = eligibleAmount * reimbursementPct

  // STEP 4 — Cap at remaining annual max if exceeded.
  const annualMaxRaw = i.remaining_annual_max
  const hasAnnualMax = annualMaxRaw !== '' && annualMaxRaw !== null && annualMaxRaw !== undefined
    && num(annualMaxRaw, 0) >= 0
  const annualMaxValue = hasAnnualMax ? num(annualMaxRaw, 0) : Infinity
  const annualMaxApplied = hasAnnualMax && grossReimbursement > annualMaxValue
  const finalReimbursement = annualMaxApplied ? annualMaxValue : grossReimbursement

  // STEP 5 — Patient out-of-pocket = practice fee total − final reimbursement.
  const patientOOP = Math.max(0, practiceFeeTotal - finalReimbursement)

  // ---- Warnings ----
  const warnings = []

  if (deductibleConsumesAll) {
    // Spec test 2: "Patient's deductible has not been met. The full UCR goes
    // toward the deductible." — only when deductible >= UCR (eligible == 0).
    warnings.push({
      level: 'warning',
      text: "Patient's deductible has not been met. The full UCR goes toward the deductible.",
    })
  } else if (remainingDeductible > 0) {
    warnings.push({
      level: 'info',
      text: `Patient still owes $${remainingDeductible.toFixed(2)} on their deductible before insurance pays.`,
    })
  }

  if (annualMaxApplied) {
    // Spec test 3: "Annual maximum will be exceeded. Reimbursement is capped at
    // the remaining $200." — exact phrasing.
    warnings.push({
      level: 'warning',
      text: `Annual maximum will be exceeded. Reimbursement is capped at the remaining $${annualMaxValue.toFixed(2)}.`,
    })
  }

  if (practiceFeeTotal > HIGH_FEE_REVIEW_THRESHOLD) {
    warnings.push({
      level: 'info',
      text: `Total practice fee is over $${HIGH_FEE_REVIEW_THRESHOLD.toLocaleString()} — payer may flag this for review.`,
    })
  }

  if (reimbursementPctRaw === 0) {
    warnings.push({
      level: 'info',
      text: 'OON reimbursement rate is 0% — enter the patient-specific rate to see a real estimate.',
    })
  }

  return {
    practiceFeeTotal,
    ucrPerProc,           // array, indexed same as `procedures`
    ucrTotal,             // step 1
    remainingDeductible,  // step 2 input
    eligibleAmount,       // step 2 result
    deductibleConsumesAll,// flag for warning
    reimbursementPctRaw,
    grossReimbursement,   // step 3 result
    hasAnnualMax,
    annualMaxValue,
    annualMaxApplied,
    finalReimbursement,   // step 4 result
    patientOOP,           // step 5 result
    warnings,
    perio_classification: i.perio_classification || 'unknown',
  }
}

export function emptyCostEstimate() {
  return {
    oon_reimbursement_pct: '',
    ucr_per_code: {},
    remaining_deductible: 0,
    remaining_annual_max: '',
    perio_classification: 'unknown',
  }
}

// Heuristic: a cost_estimate is "populated" if the user has touched the rate
// or any other meaningful input. Used by the wizard's collapsible to
// auto-expand when editing an existing claim.
export function hasCostEstimateData(estimate) {
  if (!estimate) return false
  if (estimate.oon_reimbursement_pct !== '' && estimate.oon_reimbursement_pct != null) return true
  if (estimate.remaining_annual_max !== '' && estimate.remaining_annual_max != null) return true
  if (Number(estimate.remaining_deductible) > 0) return true
  if (estimate.perio_classification && estimate.perio_classification !== 'unknown') return true
  if (estimate.ucr_per_code && Object.values(estimate.ucr_per_code).some(v => v !== '' && v != null)) return true
  return false
}
