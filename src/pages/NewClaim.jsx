import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Check, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { useToast } from '../components/Toast'
import {
  QUADRANTS,
  DIAGNOSIS_SUGGESTIONS,
  BONE_LOSS_SUGGESTIONS,
  checkBundlingConflicts,
  getRequirementsForClaim,
  computeHealthScore,
  buildNarrativePrompt,
  todayIso,
  formatDate,
  isSnapshotValid,
  buildRequirementsSnapshot,
  normalizeProbingDepth,
} from '../lib/utils'
import { generateNarrative, parseClinicalNotes } from '../lib/api'
import DateField from '../components/DateField'
import RequirementsChecklist from '../components/RequirementsChecklist'
import CostCalculatorCard from '../components/CostCalculatorCard'
import ConfirmDialog from '../components/ConfirmDialog'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { emptyCostEstimate, hasCostEstimateData } from '../lib/cost'
import { useResolvedRequirements } from '../lib/useResolvedRequirements'
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard'

const STEPS = [
  { n: 1, label: 'Patient & Insurance' },
  { n: 2, label: 'Procedures' },
  { n: 3, label: 'Clinical Findings' },
  { n: 4, label: 'Review & Generate' },
]

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal'

function emptyClaim() {
  return {
    claim_id: null,
    created_at: new Date().toISOString(),
    patient_name: '',
    payer_id: '',
    date_of_service: todayIso(),
    procedures: [{ cdt_code: '', quadrants: [], tooth_numbers: '', fee: '' }],
    cost_estimate: emptyCostEstimate(),
    clinical_findings: {
      diagnosis: '',
      probing_depths: { Q1: '', Q2: '', Q3: '', Q4: '' },
      bop_percentage: '',
      bone_loss: '',
      additional_notes: '',
      last_prophy_date: todayIso(),
      prior_perio_treatment: false,
      prior_perio_date: todayIso(),
    },
    generated_narrative: '',
    narrative_approved: false,
    checklist: [],
    requirements_snapshot: null,
    submission_date: null,
    outcome: null,
    outcome_date: null,
    denial_reason: null,
    denial_notes: null,
    total_fee: 0,
    status: 'draft',
  }
}

// ---------- Clinical Findings validation ----------
// Required: Diagnosis, at least one quadrant of probing depths, BOP percentage.
// Everything else is optional.
function clinicalFindingsErrors(cf = {}) {
  const errors = {}
  if (!cf.diagnosis || !cf.diagnosis.trim()) errors.diagnosis = 'Diagnosis is required.'
  const pd = cf.probing_depths || {}
  const anyProbing = ['Q1', 'Q2', 'Q3', 'Q4'].some(q => (pd[q] || '').trim())
  if (!anyProbing) errors.probing_depths = 'Enter probing depths for at least one quadrant.'
  if (!cf.bop_percentage && cf.bop_percentage !== 0) {
    errors.bop_percentage = 'Bleeding on Probing percentage is required.'
  }
  return errors
}
function clinicalFindingsValid(cf) {
  return Object.keys(clinicalFindingsErrors(cf)).length === 0
}

export default function NewClaim() {
  const { claims, generateClaimId, saveClaim } = useData()
  const navigate = useNavigate()
  const { show } = useToast()
  const [params] = useSearchParams()
  const editingId = params.get('id')

  const [step, setStep] = useState(1)
  const [claim, setClaim] = useState(emptyClaim)
  const [hydrated, setHydrated] = useState(!editingId)
  // Tracks whether the user has tried to advance past a step with invalid input.
  // When true, fields render their validation errors. Reset on successful advance.
  const [validationAttempted, setValidationAttempted] = useState(false)

  useEffect(() => {
    if (!editingId) return
    const existing = claims.find(c => c.claim_id === editingId)
    if (existing) {
      setClaim({ ...emptyClaim(), ...existing })
      setHydrated(true)
    }
  }, [editingId, claims])

  // Baseline of the claim at hydration time — used to detect "real" edits for
  // the unsaved-changes guard. Captured once, then refreshed on every save so
  // the next nav check measures against the most recently saved state.
  const baselineRef = useRef(null)
  useEffect(() => {
    if (hydrated && baselineRef.current === null) {
      baselineRef.current = JSON.stringify(claim)
    }
  }, [hydrated, claim])
  const isDirty = hydrated && baselineRef.current !== null && baselineRef.current !== JSON.stringify(claim)
  const guardBypassRef = useRef(false)
  const blocker = useUnsavedChangesGuard(isDirty, guardBypassRef)

  const totalFee = useMemo(
    () => claim.procedures.reduce((sum, p) => sum + (Number(p.fee) || 0), 0),
    [claim.procedures]
  )

  const canAdvance = useMemo(() => {
    if (step === 1) return !!claim.payer_id && !!claim.date_of_service
    if (step === 2) return claim.procedures.length > 0 && claim.procedures.every(p => p.cdt_code && (Number(p.fee) >= 0))
    if (step === 3) return clinicalFindingsValid(claim.clinical_findings)
    return true
  }, [step, claim])

  // Saves the wizard's claim to localStorage. Returns the saved claim_id.
  // Caller controls navigation — the wizard's footer buttons navigate to the
  // claim detail page, while the unsaved-changes dialog defers navigation to
  // `blocker.proceed()` so the user lands on whatever they originally clicked.
  const saveDraftSilently = async (markReady = false) => {
    const claim_id = claim.claim_id || generateClaimId()
    const next = {
      ...claim,
      claim_id,
      total_fee: totalFee,
      status: markReady ? 'ready' : 'draft',
    }
    await saveClaim(next)
    // Refresh the dirty-detection baseline so isDirty becomes false post-save.
    baselineRef.current = JSON.stringify(next)
    return claim_id
  }

  const persistDraft = async (markReady = false) => {
    try {
      guardBypassRef.current = true
      const claim_id = await saveDraftSilently(markReady)
      show(markReady ? 'Claim marked as ready' : 'Draft saved', 'success')
      navigate(`/claims/${claim_id}`)
    } catch {
      guardBypassRef.current = false
      show('Failed to save claim', 'error')
    }
  }

  if (!hydrated) {
    return <div className="text-text-muted">Loading claim…</div>
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-strong">{editingId ? `Edit Claim ${editingId}` : 'New Claim'}</h1>
        <p className="text-text-muted mt-1">Enter patient, procedures, and findings, then review documentation requirements.</p>
      </header>

      <Stepper current={step} onJump={(n) => { if (n < step || canAdvance) setStep(n) }} />

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {step === 1 && <Step1 claim={claim} setClaim={setClaim} />}
        {step === 2 && <Step2 claim={claim} setClaim={setClaim} totalFee={totalFee} />}
        {step === 3 && <Step3 claim={claim} setClaim={setClaim} validationAttempted={validationAttempted} />}
        {step === 4 && <Step4 claim={claim} setClaim={setClaim} totalFee={totalFee} onSaveDraft={() => persistDraft(false)} onMarkReady={() => persistDraft(true)} />}
      </div>

      <UnsavedChangesDialog
        blocker={blocker}
        onSave={() => saveDraftSilently(false)}
        onSaveError={() => show('Save failed', 'error')}
        saveLabel="Save as Draft & Leave"
        message="Save this claim as a draft before leaving?"
      />

      {step !== 4 && (
        <div className="flex justify-between">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-text-muted hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex gap-2">
            <button onClick={() => persistDraft(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-text-strong hover:bg-gray-50">
              Save as Draft
            </button>
            <button
              onClick={() => {
                if (!canAdvance) {
                  // Show validation errors if user tries to advance without meeting requirements.
                  setValidationAttempted(true)
                  return
                }
                setValidationAttempted(false)
                setStep(s => Math.min(4, s + 1))
              }}
              disabled={false}  // we handle validation in onClick so we can show messages
              className={`inline-flex items-center gap-1 px-4 py-2 text-sm rounded-md ${canAdvance ? 'bg-navy text-white hover:opacity-90' : 'bg-navy/50 text-white cursor-not-allowed'}`}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ current, onJump }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <li key={s.n} className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(s.n)}
              className={`flex items-center gap-2 ${active ? 'text-text-strong' : 'text-text-muted'}`}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                done ? 'bg-teal text-white' : active ? 'bg-navy text-white' : 'bg-gray-200 text-text-muted'
              }`}>
                {done ? <Check size={14} /> : s.n}
              </span>
              <span className="text-sm font-medium hidden md:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-teal' : 'bg-gray-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

// ---------- Step 1 ----------

function Step1({ claim, setClaim }) {
  const { payers } = useData()
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search.trim()) return payers
    const q = search.toLowerCase()
    return payers.filter(p => p.name.toLowerCase().includes(q) || p.plan_type?.toLowerCase().includes(q))
  }, [payers, search])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Patient ID / Reference">
        <input
          className={inputCls}
          placeholder="Patient ID, initials, or any reference (optional)"
          value={claim.patient_name}
          onChange={e => setClaim({ ...claim, patient_name: e.target.value })}
        />
      </Field>
      <Field label="Date of Service">
        <DateField
          className={inputCls}
          value={claim.date_of_service}
          onChange={e => setClaim({ ...claim, date_of_service: e.target.value })}
        />
      </Field>
      <Field label="Payer" className="md:col-span-2">
        <input
          className={inputCls}
          placeholder="Search payers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="mt-2 border border-gray-200 rounded-md max-h-56 overflow-y-auto divide-y divide-gray-100">
          {filtered.map(p => (
            <button
              type="button"
              key={p.payer_id}
              onClick={() => { setClaim({ ...claim, payer_id: p.payer_id }); setSearch(p.name) }}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between ${claim.payer_id === p.payer_id ? 'bg-teal/10' : ''}`}
            >
              <span className="text-sm font-medium text-text-strong">{p.name}</span>
              <span className="text-xs text-text-muted">{p.plan_type}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-3 text-sm text-text-muted">No payers match.</div>}
        </div>
      </Field>
    </div>
  )
}

// ---------- Step 2 ----------

function Step2({ claim, setClaim, totalFee }) {
  const { cdtCodes, getFeeForCode } = useData()
  const warnings = useMemo(() => checkBundlingConflicts(claim.procedures), [claim.procedures])

  const updateProc = (idx, patch) => {
    const next = [...claim.procedures]
    next[idx] = { ...next[idx], ...patch }
    setClaim({ ...claim, procedures: next })
  }
  const removeProc = (idx) => {
    setClaim({ ...claim, procedures: claim.procedures.filter((_, i) => i !== idx) })
  }
  const addProc = () => {
    setClaim({ ...claim, procedures: [...claim.procedures, { cdt_code: '', quadrants: [], tooth_numbers: '', fee: '' }] })
  }

  return (
    <div className="space-y-4">
      {claim.procedures.map((proc, i) => (
        <ProcedureRow
          key={i}
          idx={i}
          proc={proc}
          cdtCodes={cdtCodes}
          getFeeForCode={getFeeForCode}
          onUpdate={(patch) => updateProc(i, patch)}
          onRemove={claim.procedures.length > 1 ? () => removeProc(i) : null}
        />
      ))}

      <button onClick={addProc} className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
        <Plus size={16} /> Add Another Procedure
      </button>

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-3 border border-warning/40 bg-warning/10 rounded-md text-sm text-yellow-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-3 flex justify-end text-sm">
        <span className="text-text-muted mr-2">Total fee:</span>
        <span className="font-semibold text-text-strong">${totalFee.toFixed(2)}</span>
      </div>
    </div>
  )
}

function ProcedureRow({ idx, proc, cdtCodes, getFeeForCode, onUpdate, onRemove }) {
  const [search, setSearch] = useState('')
  const cdt = cdtCodes.find(c => c.code === proc.cdt_code)
  const matches = useMemo(() => {
    if (!search.trim()) return cdtCodes.slice(0, 8)
    const q = search.toLowerCase()
    return cdtCodes.filter(c => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)).slice(0, 8)
  }, [cdtCodes, search])

  const pickCode = (code) => {
    // Autofill the fee from the saved Settings → Fee Schedule when available;
    // user can still edit the fee inline for this claim.
    const defaultFee = getFeeForCode?.(code)
    onUpdate({
      cdt_code: code,
      fee: defaultFee != null ? String(defaultFee) : (proc.fee || ''),
    })
  }
  const defaultFeeForCode = cdt ? getFeeForCode?.(cdt.code) : null
  const usingDefaultFee = defaultFeeForCode != null && Number(proc.fee) === defaultFeeForCode

  return (
    <div className="border border-gray-200 rounded-md p-4 space-y-3">
      <div className="flex justify-between items-start">
        <h4 className="font-medium text-text-strong">Procedure {idx + 1}</h4>
        {onRemove && (
          <button onClick={onRemove} className="text-text-muted hover:text-danger" aria-label="Remove procedure">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <Field label="CDT Code">
        {cdt ? (
          <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
            <div className="text-sm">
              <span className="font-mono font-medium text-text-strong">{cdt.code}</span>
              <span className="text-text-muted"> — {cdt.description}</span>
            </div>
            <button onClick={() => onUpdate({ cdt_code: '', quadrants: [], tooth_numbers: '' })} className="text-xs text-text-muted hover:text-navy">Change</button>
          </div>
        ) : (
          <>
            <input className={inputCls} placeholder="Search by code or description (e.g., D4341 or scaling)…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="mt-2 border border-gray-200 rounded-md max-h-56 overflow-y-auto divide-y divide-gray-100">
              {matches.map(c => {
                const fee = getFeeForCode?.(c.code)
                return (
                  <button type="button" key={c.code} onClick={() => pickCode(c.code)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                    <div className="text-sm flex items-center justify-between gap-3">
                      <span><span className="font-mono font-medium text-text-strong">{c.code}</span> — {c.description}</span>
                      {fee != null && <span className="text-xs text-teal font-medium shrink-0">${fee.toFixed(2)}</span>}
                    </div>
                  </button>
                )
              })}
              {matches.length === 0 && <div className="px-3 py-3 text-sm text-text-muted">No codes match.</div>}
            </div>
          </>
        )}
      </Field>

      {cdt?.requires_quadrant && (
        <Field label="Quadrants">
          <div className="flex flex-wrap gap-2">
            {QUADRANTS.map(q => {
              const checked = proc.quadrants?.includes(q.key)
              return (
                <label key={q.key} className={`px-3 py-1.5 border rounded-md text-sm cursor-pointer ${checked ? 'bg-teal/15 border-teal text-teal' : 'border-gray-300 text-text-muted hover:bg-gray-50'}`}>
                  <input type="checkbox" className="hidden" checked={checked} onChange={(e) => {
                    const set = new Set(proc.quadrants || [])
                    if (e.target.checked) set.add(q.key); else set.delete(q.key)
                    onUpdate({ quadrants: Array.from(set) })
                  }} />
                  {q.key} <span className="text-xs opacity-70">({q.label})</span>
                </label>
              )
            })}
          </div>
        </Field>
      )}

      {cdt?.requires_tooth_numbers && (
        <Field label="Tooth Numbers">
          <input className={inputCls} placeholder="Comma-separated, e.g., 3, 14, 19" value={proc.tooth_numbers || ''} onChange={e => onUpdate({ tooth_numbers: e.target.value })} />
        </Field>
      )}

      <Field label="Fee for this procedure">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls + ' pl-7'}
            placeholder={cdt && defaultFeeForCode == null ? 'No default — set one in Settings → Fee Schedule' : 'e.g., 350'}
            value={proc.fee}
            onChange={e => onUpdate({ fee: e.target.value })}
          />
        </div>
        {cdt && (
          <div className="mt-1 flex items-center justify-between text-xs">
            {usingDefaultFee ? (
              <span className="text-teal">Auto-filled from fee schedule</span>
            ) : defaultFeeForCode != null ? (
              <span className="text-text-muted">
                Fee schedule default: ${defaultFeeForCode.toFixed(2)} —{' '}
                <button type="button" onClick={() => onUpdate({ fee: String(defaultFeeForCode) })} className="text-teal hover:underline">reset</button>
              </span>
            ) : (
              <span className="text-text-muted">No default fee for {cdt.code}. Set one in Settings → Fee Schedule to auto-fill next time.</span>
            )}
          </div>
        )}
      </Field>
    </div>
  )
}

// ---------- Step 3 (Clinical Findings) ----------

function Step3({ claim, setClaim, validationAttempted }) {
  const cf = claim.clinical_findings
  const setCf = (patch) => setClaim({ ...claim, clinical_findings: { ...cf, ...patch } })

  // Live errors map. Only surface visually after the user has tried to advance.
  const errors = clinicalFindingsErrors(cf)
  const showErrors = validationAttempted
  const errCls = (key) => showErrors && errors[key]
    ? 'border-danger bg-danger/5 focus:ring-danger/30 focus:border-danger'
    : ''
  const probingError = showErrors && errors.probing_depths

  return (
    <div className="space-y-5">
      <SmartPaste claim={claim} setClaim={setClaim} />

      <p className="text-sm text-text-muted">
        Fields marked with <span className="text-danger font-semibold">*</span> are required.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label={<>Diagnosis <Required /></>} className="md:col-span-2">
        <input
          list="diagnosis-suggestions"
          className={`${inputCls} ${errCls('diagnosis')}`}
          value={cf.diagnosis}
          onChange={e => setCf({ diagnosis: e.target.value })}
          placeholder="e.g., Generalized Stage III, Grade B periodontitis"
        />
        <datalist id="diagnosis-suggestions">
          {DIAGNOSIS_SUGGESTIONS.map(d => <option key={d} value={d} />)}
        </datalist>
        {showErrors && errors.diagnosis && <FieldError>{errors.diagnosis}</FieldError>}
      </Field>

      <div className="md:col-span-2">
        <div className="text-sm font-medium text-text-strong mb-1">
          Probing Depths <Required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUADRANTS.map(q => (
            <label key={q.key} className="block">
              <span className="block text-xs text-text-muted mb-1">{q.clinicalKey} ({q.label})</span>
              <input
                className={`${inputCls} ${probingError ? 'border-danger bg-danger/5' : ''}`}
                placeholder="e.g., 5-8mm"
                value={cf.probing_depths[q.clinicalKey]}
                onChange={e => setCf({ probing_depths: { ...cf.probing_depths, [q.clinicalKey]: e.target.value } })}
                onBlur={e => {
                  const normalized = normalizeProbingDepth(e.target.value)
                  if (normalized !== e.target.value) {
                    setCf({ probing_depths: { ...cf.probing_depths, [q.clinicalKey]: normalized } })
                  }
                }}
              />
            </label>
          ))}
        </div>
        {probingError && <FieldError>{errors.probing_depths}</FieldError>}
      </div>

      <Field label={<>Bleeding on Probing <Required /></>}>
        <div className="relative">
          <input
            type="number" min="0" max="100"
            className={`${inputCls} pr-12 ${errCls('bop_percentage')}`}
            placeholder="e.g., 82"
            value={cf.bop_percentage}
            onChange={e => setCf({ bop_percentage: e.target.value })}
          />
          <span className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-teal/15 text-teal font-semibold text-base leading-none pointer-events-none">%</span>
        </div>
        {showErrors && errors.bop_percentage && <FieldError>{errors.bop_percentage}</FieldError>}
      </Field>

      <Field label="Bone Loss">
        <input list="bone-loss-suggestions" className={inputCls} value={cf.bone_loss} onChange={e => setCf({ bone_loss: e.target.value })} placeholder="e.g., Moderate horizontal, 3-4mm" />
        <datalist id="bone-loss-suggestions">
          {BONE_LOSS_SUGGESTIONS.map(d => <option key={d} value={d} />)}
        </datalist>
      </Field>

      <Field label="Additional Notes" className="md:col-span-2">
        <textarea rows={3} className={inputCls} placeholder="e.g., Heavy subgingival calculus, furcation involvement on #3 and #14" value={cf.additional_notes} onChange={e => setCf({ additional_notes: e.target.value })} />
      </Field>

      <Field label="Date of Last Prophylaxis / Maintenance">
        <DateField className={inputCls} value={cf.last_prophy_date} onChange={e => setCf({ last_prophy_date: e.target.value })} />
      </Field>

      <div className="md:col-span-2 space-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={cf.prior_perio_treatment} onChange={e => setCf({ prior_perio_treatment: e.target.checked })} />
          <span className="text-sm text-text-strong">Patient has had prior SRP or periodontal surgery</span>
        </label>
        {cf.prior_perio_treatment && (
          <Field label="Date of Prior Treatment" className="max-w-xs">
            <DateField className={inputCls} value={cf.prior_perio_date} onChange={e => setCf({ prior_perio_date: e.target.value })} />
          </Field>
        )}
      </div>
      </div>
    </div>
  )
}

function SmartPaste({ claim, setClaim }) {
  const { show } = useToast()
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)

  const onParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    try {
      const data = await parseClinicalNotes({ notesText: text })
      // Merge: AI fills empty user fields; AI's non-empty values override empty current values.
      const cf = claim.clinical_findings
      const filled = []
      const merged = {
        diagnosis: data.diagnosis || cf.diagnosis,
        probing_depths: {
          Q1: data.probing_depths?.Q1 || cf.probing_depths.Q1,
          Q2: data.probing_depths?.Q2 || cf.probing_depths.Q2,
          Q3: data.probing_depths?.Q3 || cf.probing_depths.Q3,
          Q4: data.probing_depths?.Q4 || cf.probing_depths.Q4,
        },
        bop_percentage: data.bop_percentage || cf.bop_percentage,
        bone_loss: data.bone_loss || cf.bone_loss,
        additional_notes: data.additional_notes || cf.additional_notes,
        last_prophy_date: data.last_prophy_date || cf.last_prophy_date,
        prior_perio_treatment: data.prior_perio_treatment ?? cf.prior_perio_treatment,
        prior_perio_date: data.prior_perio_date || cf.prior_perio_date,
      }
      // Track which fields the AI populated (non-empty in the response).
      if (data.diagnosis) filled.push('diagnosis')
      ;['Q1','Q2','Q3','Q4'].forEach(k => { if (data.probing_depths?.[k]) filled.push(`probing ${k}`) })
      if (data.bop_percentage) filled.push('BOP')
      if (data.bone_loss) filled.push('bone loss')
      if (data.additional_notes) filled.push('notes')
      if (data.last_prophy_date) filled.push('last prophy')
      if (data.prior_perio_treatment) filled.push('prior treatment')

      setClaim({ ...claim, clinical_findings: merged })
      setText('')
      show(filled.length ? `Filled ${filled.length} field${filled.length === 1 ? '' : 's'}: ${filled.join(', ')}` : 'No fields could be extracted from those notes', filled.length ? 'success' : 'warning')
    } catch (err) {
      show(err.message || 'Failed to parse notes', 'error')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="border border-teal/40 bg-teal/5 rounded-md p-4">
      <h4 className="font-medium text-text-strong flex items-center gap-1.5 mb-2">
        <Sparkles size={14} className="text-teal" /> Smart Paste
      </h4>
      <p className="text-xs text-text-muted mb-2">
        Paste clinical notes from your charting software, EMR, or anywhere else. Claude will extract diagnosis, probing depths, BOP, bone loss, and other findings into the fields below. You can edit anything afterwards.
      </p>
      <textarea
        rows={6}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste your clinical notes here…"
        className={inputCls + ' font-mono text-xs'}
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={onParse}
          disabled={parsing || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-40 shrink-0"
        >
          {parsing ? <><Loader2 className="animate-spin" size={14} /> Parsing…</> : <><Sparkles size={14} /> Parse & Fill</>}
        </button>
      </div>
    </div>
  )
}

// ---------- Step 4 ----------

function Step4({ claim, setClaim, totalFee, onSaveDraft, onMarkReady }) {
  const { cdtCodes, getPayer } = useData()
  const { show } = useToast()
  const payer = getPayer(claim.payer_id)
  // Skip the AI fetch when the wizard already has a valid per-claim snapshot.
  // The snapshot ships with the claim on save so the Claim Detail page also
  // doesn't refetch — net result: AI runs once for the lifetime of a claim
  // (until the user clicks Refresh Requirements or changes payer/codes).
  const hasSnapshot = isSnapshotValid(claim)
  const { groups: liveGroups, saveAi, retryAi } = useResolvedRequirements(hasSnapshot ? null : claim)
  const requirementGroups = useMemo(() => {
    if (hasSnapshot) {
      return (claim.requirements_snapshot.groups || []).map(g => ({ ...g, frozen: true }))
    }
    return liveGroups
  }, [hasSnapshot, claim, liveGroups])

  // Auto-snapshot the live AI result onto the wizard's claim state the first
  // time it's fully resolved.
  const snapshotInFlight = useRef(false)
  useEffect(() => {
    if (isSnapshotValid(claim)) return
    if (snapshotInFlight.current) return
    if (!liveGroups || liveGroups.length === 0) return
    if (!liveGroups.every(g => g.source === 'payer' || g.source === 'ai-suggested')) return
    snapshotInFlight.current = true
    setClaim(c => ({ ...c, requirements_snapshot: buildRequirementsSnapshot(c, liveGroups) }))
  }, [claim, liveGroups, setClaim])

  // Reset the in-flight latch whenever the snapshot is cleared (e.g. on
  // Refresh) so the next resolution can fire another save.
  useEffect(() => {
    if (!claim.requirements_snapshot) snapshotInFlight.current = false
  }, [claim.requirements_snapshot])

  const [generating, setGenerating] = useState(false)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const onRefreshRequirements = () => {
    setConfirmRefresh(false)
    setClaim(c => ({ ...c, requirements_snapshot: null, checklist: [] }))
  }

  const checked = new Set(claim.checklist || [])
  const toggleItem = (item) => {
    const next = new Set(checked)
    if (next.has(item)) next.delete(item); else next.add(item)
    setClaim({ ...claim, checklist: Array.from(next) })
  }

  const score = computeHealthScore(claim, requirementGroups)
  const allWatchOuts = [...new Set(requirementGroups.flatMap(g => g.watch_outs))]

  const onGenerate = async () => {
    setGenerating(true)
    try {
      const elements = requirementGroups.flatMap(g => g.narrative_elements)
      const prompt = buildNarrativePrompt({ claim, payerName: payer?.name, narrativeElements: elements, cdtCodes })
      const text = await generateNarrative({ prompt })
      setClaim({ ...claim, generated_narrative: text, narrative_approved: false })
      show('Narrative generated — review and approve', 'success')
    } catch (err) {
      show(err.message || 'Narrative generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const approveNarrative = () => {
    setClaim({ ...claim, narrative_approved: true })
    show('Narrative approved', 'success')
  }

  return (
    <div className="space-y-8">
      {/* === Top summary bar: prominent Total Fee + always-available Save as Draft === */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white border border-border-warm rounded-lg">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Total Fee</div>
          <div className="font-serif text-3xl text-text-strong leading-tight mt-0.5">${totalFee.toFixed(2)}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSaveDraft}
            className="px-4 py-2 text-sm border border-border-warm rounded-full text-text-strong hover:bg-cream-light"
          >
            Save as Draft
          </button>
          <button
            onClick={onMarkReady}
            disabled={score !== 'green'}
            className="px-4 py-2 text-sm bg-navy text-cream-light rounded-full hover:opacity-90 disabled:opacity-40"
          >
            Mark as Ready
          </button>
        </div>
      </div>

      {/* === Requirements Checklist (most prominent — health score + progress + items) === */}
      <div className="space-y-3">
        {claim.requirements_snapshot && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-1">
            <span className="text-xs text-text-muted">
              Requirements loaded {formatDate(claim.requirements_snapshot.generated_at)}
            </span>
            <button
              onClick={() => setConfirmRefresh(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-warm rounded-full text-text-strong hover:bg-cream-light"
            >
              <RefreshCw size={12} /> Refresh Requirements
            </button>
          </div>
        )}
        <RequirementsChecklist
          groups={requirementGroups}
          checked={checked}
          onToggle={toggleItem}
          score={score}
          onSaveAi={saveAi}
          onRetryAi={retryAi}
        />
      </div>

      <ConfirmDialog
        open={confirmRefresh}
        title="Refresh requirements?"
        message="This will reset your checklist. Are you sure?"
        confirmLabel="Refresh"
        danger
        onCancel={() => setConfirmRefresh(false)}
        onConfirm={onRefreshRequirements}
      />

      {/* === Watch-outs (after the checklist) === */}
      {allWatchOuts.length > 0 && (
        <section>
          <h3 className="font-serif text-xl text-text-strong mb-3">Watch-outs</h3>
          <div className="space-y-2">
            {allWatchOuts.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3.5 border border-warning/40 bg-warning/10 rounded-md text-sm text-text-strong">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-warning" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === Patient Cost Calculator — collapsed by default; auto-expands when data present === */}
      <ReviewCostEstimate claim={claim} setClaim={setClaim} />

      {/* === Clinical Narrative (after watch-outs) === Always shows the
          textarea + a prominent Generate / Regenerate button so the AI entry
          point is never hidden behind a branch. */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl text-text-strong">Clinical Narrative</h3>
          {claim.narrative_approved && (
            <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
              <Check size={14} /> Approved
            </span>
          )}
        </div>
        <div className="space-y-2">
          <textarea
            className={inputCls + ' min-h-[200px] font-serif text-base leading-relaxed'}
            value={claim.generated_narrative || ''}
            onChange={e => setClaim({ ...claim, generated_narrative: e.target.value, narrative_approved: false })}
            placeholder="Write or paste your clinical narrative here, or click Generate Narrative with Claude below."
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-cream-light rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generating
                ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
                : <><Sparkles size={16} /> {claim.generated_narrative?.trim() ? 'Regenerate with Claude' : 'Generate Narrative with Claude'}</>}
            </button>
            {!claim.narrative_approved && (
              <button
                onClick={approveNarrative}
                disabled={!claim.generated_narrative?.trim() || generating}
                className="px-3.5 py-2 text-sm bg-success text-white rounded-full hover:opacity-90 disabled:opacity-40"
              >
                Approve Narrative
              </button>
            )}
          </div>
        </div>
      </section>

      {/* === Total + actions === */}
      <div className="border-t border-border-warm pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-text-muted">Total fee:</span>
          <span className="font-semibold text-text-strong ml-2">${totalFee.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onSaveDraft} className="px-4 py-2 text-sm border border-border-warm rounded-full text-text-strong hover:bg-cream-light">Save as Draft</button>
          <button
            onClick={onMarkReady}
            disabled={score !== 'green'}
            className="px-4 py-2 text-sm bg-navy text-cream-light rounded-full hover:opacity-90 disabled:opacity-40"
          >
            Mark as Ready
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-text-strong mb-1">{label}</span>
      {children}
    </label>
  )
}

function Required() {
  return <span className="text-danger font-semibold ml-0.5" aria-label="required">*</span>
}

function FieldError({ children }) {
  return <p className="text-xs text-danger mt-1">{children}</p>
}

// Patient Cost Calculator on the Review step — same shared card as Claim
// Detail. Auto-opens when an estimate already exists (editing flow); blank
// new claims start collapsed so the main flow stays scannable.
function ReviewCostEstimate({ claim, setClaim }) {
  const { cdtCodes } = useData()
  return (
    <CostCalculatorCard
      procedures={claim.procedures}
      cdtCodes={cdtCodes}
      value={claim.cost_estimate || emptyCostEstimate()}
      onChange={(next) => setClaim({ ...claim, cost_estimate: next })}
      initiallyOpen={hasCostEstimateData(claim.cost_estimate)}
    />
  )
}
