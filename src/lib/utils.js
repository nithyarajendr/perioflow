// Shared helpers: bundling rules, status styling, claim health scoring,
// narrative prompt builder, formatters.

export const QUADRANTS = [
  { key: 'UR', label: 'Upper Right', clinicalKey: 'Q1' },
  { key: 'UL', label: 'Upper Left', clinicalKey: 'Q2' },
  { key: 'LL', label: 'Lower Left', clinicalKey: 'Q3' },
  { key: 'LR', label: 'Lower Right', clinicalKey: 'Q4' },
]

export const DIAGNOSIS_SUGGESTIONS = [
  'Generalized Stage III, Grade B periodontitis',
  'Localized Stage III, Grade B periodontitis',
  'Generalized Stage II, Grade A periodontitis',
  'Localized Stage II, Grade A periodontitis',
  'Generalized Stage IV, Grade C periodontitis',
]

export const BONE_LOSS_SUGGESTIONS = [
  'Mild horizontal, 1-2mm',
  'Moderate horizontal, 3-4mm',
  'Severe horizontal, 5mm+',
  'Vertical defect present',
]

export const DENIAL_REASONS = [
  'Insufficient documentation',
  'Narrative does not support medical necessity',
  'Required radiographs not included',
  'Perio charting not included',
  'Frequency limitation exceeded',
  'Procedure not covered by plan',
  'Pre-authorization required but not obtained',
  'Bundling conflict',
  'Downgraded to different code',
  'Other',
]

export const STATUS_STYLES = {
  draft: { label: 'Draft', cls: 'bg-gray-200 text-gray-700' },
  ready: { label: 'Ready', cls: 'bg-teal/15 text-teal' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', cls: 'bg-success/15 text-success' },
  denied: { label: 'Denied', cls: 'bg-danger/15 text-danger' },
  pended: { label: 'Pended', cls: 'bg-warning/15 text-yellow-700' },
}

// Hardcoded bundling-conflict pairs derived from CDT bundling_rules text.
// A conflict is flagged when both `code` and an entry from `conflicts` appear
// in the same claim under the matching scope ('quadrant', 'date', 'always').
const BUNDLING_CONFLICTS = [
  { codes: ['D4341', 'D4342'], conflicts: ['D4210', 'D4211'], scope: 'quadrant', message: '{a} is not separately billable when performed same day as {b} on the same quadrant.' },
  { codes: ['D4346'], conflicts: ['D4341', 'D4342'], scope: 'date', message: 'D4346 cannot be billed on the same date as {b}.' },
  { codes: ['D4355'], conflicts: ['D4341', 'D4342', 'D4346'], scope: 'date', message: 'D4355 cannot be billed with {b} on the same day.' },
  { codes: ['D4260', 'D4261'], conflicts: ['D4210', 'D4211'], scope: 'quadrant', message: '{a} cannot be billed same day as {b} on the same quadrant.' },
  { codes: ['D4274'], conflicts: ['D4210', 'D4211'], scope: 'always', message: 'D4274 is inclusive to {b} when present.' },
  { codes: ['D0180'], conflicts: ['D0150'], scope: 'date', message: 'D0180 cannot be billed with D0150 on the same day.' },
]

const REQUIRES_COMPANION = [
  { code: 'D4264', requires: 'D4263', message: 'D4264 must be billed alongside D4263.' },
  { code: 'D4283', requires: 'D4273', message: 'D4283 must be billed alongside D4273.' },
]

export function checkBundlingConflicts(procedures) {
  const warnings = []
  const codes = procedures.map(p => p.cdt_code).filter(Boolean)
  for (let i = 0; i < procedures.length; i++) {
    const a = procedures[i]
    if (!a.cdt_code) continue
    for (let j = i + 1; j < procedures.length; j++) {
      const b = procedures[j]
      if (!b.cdt_code) continue
      for (const rule of BUNDLING_CONFLICTS) {
        const aMatchesCode = rule.codes.includes(a.cdt_code)
        const bMatchesConflict = rule.conflicts.includes(b.cdt_code)
        const bMatchesCode = rule.codes.includes(b.cdt_code)
        const aMatchesConflict = rule.conflicts.includes(a.cdt_code)
        const direct = aMatchesCode && bMatchesConflict
        const reverse = bMatchesCode && aMatchesConflict
        if (!direct && !reverse) continue
        if (rule.scope === 'quadrant') {
          const aQ = a.quadrants || []
          const bQ = b.quadrants || []
          const overlap = aQ.some(q => bQ.includes(q))
          if (!overlap) continue
        }
        warnings.push(rule.message
          .replace('{a}', direct ? a.cdt_code : b.cdt_code)
          .replace('{b}', direct ? b.cdt_code : a.cdt_code))
      }
    }
  }
  for (const r of REQUIRES_COMPANION) {
    if (codes.includes(r.code) && !codes.includes(r.requires)) {
      warnings.push(r.message)
    }
  }
  return [...new Set(warnings)]
}

export function getRequirementsForClaim(claim, requirements, cdtCodes) {
  // Returns an array of { source: 'payer'|'cdt', cdt_code, items: [{item,priority,denial_risk}] }
  const out = []
  for (const proc of claim.procedures || []) {
    const match = requirements.find(r => r.payer_id === claim.payer_id && r.cdt_code === proc.cdt_code)
    if (match) {
      out.push({ source: 'payer', cdt_code: proc.cdt_code, items: match.required_documents, watch_outs: match.watch_outs || [], narrative_elements: match.narrative_elements || [] })
    } else {
      const cdt = cdtCodes.find(c => c.code === proc.cdt_code)
      const items = (cdt?.common_documentation || []).map(item => ({ item, priority: 'required', denial_risk: 'medium' }))
      out.push({ source: 'cdt', cdt_code: proc.cdt_code, items, watch_outs: cdt?.common_denial_reasons || [], narrative_elements: [] })
    }
  }
  return out
}

// Detailed breakdown used by the health-score card. Counts required vs
// recommended items separately and reports the narrative status as its own
// independent signal so the UI can show what's done vs blocking.
//
// Status semantics:
//   • green  — every required item is checked AND the narrative is approved
//              (recommended items may or may not be checked).
//   • yellow — every required item is checked, but either some recommended
//              items are unchecked OR the narrative is not yet approved.
//              Mark as Ready is allowed but with a confirmation modal.
//   • red    — at least one required item is still unchecked. Mark as Ready
//              is disabled.
//   • null   — requirements haven't loaded yet (or errored) — UI should
//              render a loading / error state instead of a status.
export function computeHealthBreakdown(claim, requirementGroups) {
  const groups = requirementGroups || []
  const unresolved = groups.some(g => g.source === 'ai-loading' || g.source === 'ai-error')
  if (unresolved) return { status: null, unresolved: true }

  const checked = new Set(claim.checklist || [])
  let requiredCount = 0, requiredChecked = 0
  let recommendedCount = 0, recommendedChecked = 0
  for (const g of groups) {
    for (const it of g.items) {
      const isReq = it.priority === 'required' || it.denial_risk === 'high'
      if (isReq) {
        requiredCount += 1
        if (checked.has(it.item)) requiredChecked += 1
      } else {
        recommendedCount += 1
        if (checked.has(it.item)) recommendedChecked += 1
      }
    }
  }
  const allRequiredChecked = requiredCount === 0 || requiredChecked === requiredCount
  const allRecommendedChecked = recommendedCount === 0 || recommendedChecked === recommendedCount
  const narrativeApproved = !!claim.narrative_approved && !!claim.generated_narrative?.trim()
  const narrativePresent = !!claim.generated_narrative?.trim()

  let status
  if (!allRequiredChecked) status = 'red'
  else if (allRecommendedChecked && narrativeApproved) status = 'green'
  else status = 'yellow'

  return {
    status,
    unresolved: false,
    requiredCount,
    requiredChecked,
    recommendedCount,
    recommendedChecked,
    narrativeApproved,
    narrativePresent,
  }
}

// Back-compat: callers that just need the status string.
export function computeHealthScore(claim, requirementGroups) {
  return computeHealthBreakdown(claim, requirementGroups).status
}

export function buildNarrativePrompt({ claim, payerName, narrativeElements, cdtCodes }) {
  const procLines = (claim.procedures || []).map(p => {
    const cdt = cdtCodes.find(c => c.code === p.cdt_code)
    const desc = cdt?.description || ''
    const loc = (p.quadrants?.length ? `quadrant(s): ${p.quadrants.join(', ')}` : '')
      || (p.tooth_numbers ? `tooth/teeth: ${p.tooth_numbers}` : '')
    return `- ${p.cdt_code} (${desc})${loc ? ' ' + loc : ''}`
  }).join('\n')

  const cf = claim.clinical_findings || {}
  const pd = cf.probing_depths || {}
  const priorPerioStr = cf.prior_perio_treatment
    ? `yes${cf.prior_perio_date ? ` (last treatment ${cf.prior_perio_date})` : ''}`
    : 'no'

  return `You are a dental insurance narrative writer for a periodontal practice. Generate a formal insurance narrative justifying the medical necessity of the procedures performed. Use clinical language that insurance adjusters expect. Be specific with measurements. Do not exaggerate or fabricate.

Patient diagnosis: ${cf.diagnosis || ''}
Procedures:
${procLines}
Probing depths: Q1: ${pd.Q1 || ''}, Q2: ${pd.Q2 || ''}, Q3: ${pd.Q3 || ''}, Q4: ${pd.Q4 || ''}
Bleeding on probing: ${cf.bop_percentage ?? ''}%
Bone loss: ${cf.bone_loss || ''}
Additional findings: ${cf.additional_notes || ''}
Date of last prophylaxis/maintenance: ${cf.last_prophy_date || ''}
Prior periodontal treatment: ${priorPerioStr}

Payer: ${payerName || ''}
Payer-specific requirements: ${narrativeElements?.length ? narrativeElements.join('; ') : 'general perio narrative standards'}

Write 1-2 paragraphs. Include specific clinical measurements. Reference the AAP periodontal classification. Justify each procedure based on the findings.`
}

export function formatDate(isoOrDate) {
  if (!isoOrDate) return ''
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

export function formatMoney(amount) {
  if (amount == null || amount === '') return '$0.00'
  return `$${Number(amount).toFixed(2)}`
}

export function todayIso() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

// True iff the claim has a requirements_snapshot whose payer + sorted CDT
// codes match the claim's current payer + procedures. Stale snapshots (e.g.
// after editing procedures) return false so the caller can re-fetch.
export function isSnapshotValid(claim) {
  const snap = claim?.requirements_snapshot
  if (!snap) return false
  if (snap.payer_id !== claim.payer_id) return false
  const newCodes = [...(claim.procedures || []).map(p => p.cdt_code).filter(Boolean)].sort()
  const oldCodes = [...(snap.cdt_codes || [])].sort()
  if (newCodes.length !== oldCodes.length) return false
  return newCodes.every((c, i) => c === oldCodes[i])
}

// Auto-append "mm" to a probing depth value when the user finishes typing.
// "5" → "5mm", "5-8" → "5-8mm". Pre-existing units, empty input, or values
// without any digit are left alone.
export function normalizeProbingDepth(text) {
  if (text == null) return ''
  const trimmed = String(text).trim()
  if (!trimmed) return ''
  if (!/\d/.test(trimmed)) return trimmed
  if (/mm\s*$/i.test(trimmed)) return trimmed
  return trimmed + 'mm'
}

// Snapshot constructor — keeps the shape consistent across wizard + detail.
export function buildRequirementsSnapshot(claim, groups) {
  return {
    generated_at: new Date().toISOString(),
    payer_id: claim.payer_id,
    cdt_codes: [...(claim.procedures || []).map(p => p.cdt_code).filter(Boolean)].sort(),
    groups,
  }
}
