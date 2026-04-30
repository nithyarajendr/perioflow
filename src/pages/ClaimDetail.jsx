import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Send, FileDown, ClipboardCheck, AlertTriangle, Check, Calculator, RefreshCw } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { useToast } from '../components/Toast'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import PrintView from '../components/PrintView'
import DateField from '../components/DateField'
import { RequirementsHealthSection, RequirementsListSection } from '../components/RequirementsChecklist'
import CostEstimatorPanel from '../components/CostEstimatorPanel'
import CostEstimatePrintView from '../components/CostEstimatePrintView'
import SectionTOC from '../components/SectionTOC'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import {
  formatDate,
  formatMoney,
  todayIso,
  computeHealthScore,
  DENIAL_REASONS,
  QUADRANTS,
  isSnapshotValid,
  buildRequirementsSnapshot,
} from '../lib/utils'
import { useResolvedRequirements } from '../lib/useResolvedRequirements'
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard'
import { emptyCostEstimate, hasCostEstimateData } from '../lib/cost'

export default function ClaimDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { claims, getPayer, settings, cdtCodes, requirements, saveClaim, deleteClaim, saveRequirement } = useData()
  const { show } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [costPrintOpen, setCostPrintOpen] = useState(false)

  const claim = claims.find(c => c.claim_id === id)
  const payer = claim ? getPayer(claim.payer_id) : null

  // ---- Draft state: inline edits accumulate here. Floating save bar shows when
  //      draft differs from the persisted claim. Save Changes commits, Discard
  //      reverts. Status transitions (Mark Ready / Submitted / Log Outcome)
  //      commit any pending draft as a side effect — no need to save twice.
  const [draft, setDraft] = useState(claim || null)
  useEffect(() => {
    // Resync when the upstream claim changes. This is a field-MERGE, not a
    // blanket replace: server-owned fields (snapshot, status, outcomes) are
    // pulled from the new claim, while in-progress draft edits to user-owned
    // fields are preserved. This is what lets the auto-snapshot save below
    // run silently in the background without clobbering live edits.
    setDraft(d => {
      if (!claim) return null
      if (!d) return claim
      return {
        ...d,
        // Server-owned: always take from upstream
        requirements_snapshot: claim.requirements_snapshot,
        status: claim.status,
        outcome: claim.outcome,
        outcome_date: claim.outcome_date,
        denial_reason: claim.denial_reason,
        denial_notes: claim.denial_notes,
        submission_date: claim.submission_date,
      }
    })
  }, [claim])

  // AI-resolved requirements: only fetch when we don't already have a frozen
  // per-claim snapshot whose payer + codes still match the claim. A snapshot
  // becomes stale when the user edits procedures via the wizard; in that case
  // we treat it as missing and refetch (which then re-snapshots).
  const hasSnapshot = isSnapshotValid(draft || claim)
  const { groups: liveGroups, saveAi, retryAi } = useResolvedRequirements(hasSnapshot ? null : (draft || claim))
  const requirementGroups = useMemo(() => {
    if (hasSnapshot) {
      const snap = (draft || claim)?.requirements_snapshot
      return (snap?.groups || []).map(g => ({ ...g, frozen: true }))
    }
    return liveGroups
  }, [hasSnapshot, draft, claim, liveGroups])

  // Auto-snapshot the resolved requirements onto the claim the FIRST time they
  // come back fully resolved (or when the existing snapshot is stale because
  // procedures changed). Saves against `claim` (not `draft`) so the
  // field-merge resync above pulls in the snapshot without disturbing live
  // edits. The ref guards against duplicate fires across renders.
  const snapshotInFlight = useRef(false)
  useEffect(() => {
    if (!claim) return
    if (isSnapshotValid(claim)) return
    if (snapshotInFlight.current) return
    if (!liveGroups || liveGroups.length === 0) return
    const allResolved = liveGroups.every(g => g.source === 'payer' || g.source === 'ai-suggested')
    if (!allResolved) return
    snapshotInFlight.current = true
    saveClaim({ ...claim, requirements_snapshot: buildRequirementsSnapshot(claim, liveGroups) })
      .catch(() => { snapshotInFlight.current = false })
  }, [claim, liveGroups, saveClaim])

  const score = useMemo(
    () => draft ? computeHealthScore(draft, requirementGroups) : null,
    [draft, requirementGroups]
  )

  // Unsaved-changes guard: blocks in-app navigation + tab close while the user
  // has uncommitted edits. Computed here (before the not-found early return)
  // because hooks must run unconditionally on every render. The bypass ref
  // lets intentional navigations (delete) skip the block without a re-render.
  const isDirty = !!claim && !!draft && JSON.stringify(claim) !== JSON.stringify(draft)
  const guardBypassRef = useRef(false)
  const blocker = useUnsavedChangesGuard(isDirty, guardBypassRef)

  if (!claim || !draft) {
    return (
      <div className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-strong"><ArrowLeft size={14} /> Back to Dashboard</Link>
        <div className="bg-white border border-border-warm rounded-lg p-8 text-center">
          <p className="text-text-strong font-medium">Claim not found</p>
          <p className="text-sm text-text-muted mt-1">No claim with id <span className="font-mono">{id}</span>.</p>
        </div>
      </div>
    )
  }

  const checked = new Set(draft.checklist || [])
  const procedureCodes = (claim.procedures || []).map(p => p.cdt_code).filter(Boolean).join(', ') || '—'

  // ---- Draft mutators (DON'T save; let the floating save bar commit) ----
  const updateClinicalField = (key, value) => {
    setDraft(d => ({ ...d, clinical_findings: { ...d.clinical_findings, [key]: value } }))
  }
  const updateProbingDepth = (q, value) => {
    setDraft(d => ({
      ...d,
      clinical_findings: {
        ...d.clinical_findings,
        probing_depths: { ...d.clinical_findings.probing_depths, [q]: value },
      },
    }))
  }
  const updateNarrative = (text) => {
    setDraft(d => ({ ...d, generated_narrative: text, narrative_approved: false }))
  }
  const approveNarrative = () => {
    setDraft(d => ({ ...d, narrative_approved: true }))
  }
  const toggleChecklistItem = (item) => {
    setDraft(d => {
      const next = new Set(d.checklist || [])
      if (next.has(item)) next.delete(item); else next.add(item)
      return { ...d, checklist: Array.from(next) }
    })
  }
  const updateCostEstimate = (next) => {
    setDraft(d => ({ ...d, cost_estimate: next }))
  }

  const onSaveDraftEdits = async () => {
    try {
      await saveClaim(draft)
      show('Changes saved', 'success')
    } catch {
      show('Save failed', 'error')
    }
  }
  const onDiscardEdits = () => {
    setDraft(claim)
    setConfirmDiscard(false)
  }

  const onRefreshRequirements = async () => {
    setConfirmRefresh(false)
    snapshotInFlight.current = false
    try {
      // Clear snapshot + checklist on the persisted claim. The next render
      // re-runs useResolvedRequirements (no snapshot), and the auto-snapshot
      // effect persists the fresh result.
      await saveClaim({ ...claim, requirements_snapshot: null, checklist: [] })
      // Also drop checklist locally so the user immediately sees a clean slate
      // even if they have unsaved edits to other fields.
      setDraft(d => ({ ...d, requirements_snapshot: null, checklist: [] }))
      show('Refreshing requirements…', 'success')
    } catch {
      show('Failed to refresh requirements', 'error')
    }
  }

  // ---- Status transition handlers — commit pending draft + the status change in one save. ----
  const onMarkReady = async () => {
    try {
      await saveClaim({ ...draft, status: 'ready' })
      show('Claim marked as ready', 'success')
    } catch {
      show('Save failed', 'error')
    }
  }
  const onMarkSubmitted = async (date) => {
    try {
      await saveClaim({ ...draft, status: 'submitted', submission_date: date })
      show('Claim marked as submitted', 'success')
      setSubmitOpen(false)
    } catch {
      show('Failed to update claim', 'error')
    }
  }
  const onLogOutcome = async ({ outcome, denial_reason, denial_notes }) => {
    const next = {
      ...draft,
      status: outcome,
      outcome,
      outcome_date: todayIso(),
      denial_reason: outcome === 'paid' ? null : denial_reason,
      denial_notes: outcome === 'paid' ? null : denial_notes,
    }
    try {
      await saveClaim(next)
      show(`Outcome logged: ${outcome}`, 'success')
      setOutcomeOpen(false)
      if (outcome === 'denied' && denial_reason) {
        await runDenialFeedback({
          newClaim: next,
          allClaims: [...claims.filter(c => c.claim_id !== claim.claim_id), next],
          requirements,
          saveRequirement,
          show,
        })
      }
    } catch {
      show('Failed to log outcome', 'error')
    }
  }

  const onDelete = async () => {
    setConfirmDelete(false)
    // Bypass the unsaved-changes guard for this intentional navigation: the
    // claim is being removed, so any "unsaved edits" are moot.
    guardBypassRef.current = true
    try {
      await deleteClaim(claim.claim_id)
      show('Claim deleted', 'success')
      navigate('/')
    } catch {
      guardBypassRef.current = false
      show('Delete failed', 'error')
    }
  }

  // TOC sections — visible to scroll-spy in this exact order. The "Cost
  // Estimate" entry appears after Clinical Findings to match the page order.
  const tocSections = [
    { id: 'patient-insurance', label: 'Patient & Insurance' },
    { id: 'claim-health-score', label: 'Claim Health Score' },
    { id: 'documentation-checklist', label: 'Documentation Checklist' },
    { id: 'procedures', label: 'Procedures' },
    { id: 'cost-estimate', label: 'Patient Cost Estimate' },
    { id: 'clinical-findings', label: 'Clinical Findings' },
    { id: 'narrative', label: 'Narrative' },
  ]

  return (
    <div className="space-y-6 max-w-5xl pb-24">
      {/* === Rich header with prominent status flow === */}
      <div id="patient-insurance" className="scroll-mt-20">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-strong mb-3">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <div className="bg-white border border-border-warm rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-serif text-3xl text-text-strong leading-tight">
                {claim.patient_name || claim.claim_id}
              </h1>
              <p className="text-text-muted text-sm mt-1.5">
                <span className="text-text-muted/80">PerioFlow tracking ID:</span>{' '}
                <span className="font-mono text-text-strong" title="Internal tracking ID for this claim — not the payer's claim number">{claim.claim_id}</span>
                <span className="mx-1.5">·</span>
                created {formatDate(claim.created_at)}
                {settings?.provider_name && (
                  <><span className="mx-1.5">·</span>{settings.provider_name}</>
                )}
              </p>
            </div>
            <SecondaryActions
              status={claim.status}
              onEdit={() => navigate(`/new-claim?id=${claim.claim_id}`)}
              onDelete={() => setConfirmDelete(true)}
              onPrint={() => setPrintOpen(true)}
            />
          </div>

          {/* === Prominent Status Flow === */}
          <StatusFlow
            status={claim.status}
            outcome={claim.outcome}
            outcomeDate={claim.outcome_date}
            denialReason={claim.denial_reason}
            score={score}
            onMarkReady={onMarkReady}
            onMarkSubmitted={() => setSubmitOpen(true)}
            onLogOutcome={() => setOutcomeOpen(true)}
          />

          {/* At-a-glance stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4 pt-4 mt-5 border-t border-border-warm">
            <HeaderStat label="Date of Service">{formatDate(claim.date_of_service) || '—'}</HeaderStat>
            <HeaderStat label="Payer">{payer?.name || claim.payer_id || '—'}</HeaderStat>
            <HeaderStat label="Plan Type">{payer?.plan_type || '—'}</HeaderStat>
            <HeaderStat label="Procedures">
              <span className="font-mono">{procedureCodes}</span>
            </HeaderStat>
            <HeaderStat label="Total Fee">
              <span className="font-serif text-2xl text-text-strong leading-none">{formatMoney(claim.total_fee)}</span>
            </HeaderStat>
          </div>
        </div>
      </div>

      {/* Sticky horizontal TOC for jumping between sections. */}
      <SectionTOC sections={tocSections} />

      {/* Documentation Requirements — split into two TOC-anchored sections so
          the scroll-spy can highlight Health Score vs Documentation Checklist
          independently as the user scrolls. */}
      <div id="claim-health-score" className="scroll-mt-20">
        <RequirementsHealthSection
          groups={requirementGroups}
          checked={checked}
          score={score}
        />
      </div>
      <div id="documentation-checklist" className="scroll-mt-20 space-y-3">
        {draft.requirements_snapshot && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-1">
            <span className="text-xs text-text-muted">
              Requirements loaded {formatDate(draft.requirements_snapshot.generated_at)}
            </span>
            <button
              onClick={() => setConfirmRefresh(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-warm rounded-full text-text-strong hover:bg-cream-light"
            >
              <RefreshCw size={12} /> Refresh Requirements
            </button>
          </div>
        )}
        <RequirementsListSection
          groups={requirementGroups}
          checked={checked}
          onToggle={toggleChecklistItem}
          onSaveAi={saveAi}
          onRetryAi={retryAi}
        />
      </div>

      <div id="procedures" className="scroll-mt-20">
      <Section title="Procedures">
        <table className="w-full text-sm">
          <thead className="bg-cream-light text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2">CDT</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2 text-right">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-warm">
            {claim.procedures.map((p, i) => {
              const cdt = cdtCodes.find(c => c.code === p.cdt_code)
              const loc = (p.quadrants?.length ? p.quadrants.join(', ') : null) || p.tooth_numbers || '—'
              return (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-text-strong">{p.cdt_code}</td>
                  <td className="px-3 py-2 text-text-muted">{cdt?.description || '—'}</td>
                  <td className="px-3 py-2 text-text-muted">{loc}</td>
                  <td className="px-3 py-2 text-right text-text-strong">{formatMoney(p.fee)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-warm">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-text-strong">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-text-strong">{formatMoney(claim.total_fee)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>
      </div>

      {/* === Patient Cost Estimate — promoted above Clinical Findings so it's
           harder to miss. The card style is brighter than ordinary Sections to
           pull the eye, and an empty state explicitly invites the user in. === */}
      <div id="cost-estimate" className="scroll-mt-20">
        <PatientCostEstimateCard
          procedures={claim.procedures}
          cdtCodes={cdtCodes}
          value={draft.cost_estimate || emptyCostEstimate()}
          onChange={updateCostEstimate}
          onPrint={() => setCostPrintOpen(true)}
        />
      </div>

      {/* Clinical Findings — inline editable. Edits accumulate in draft; floating save bar commits. */}
      <div id="clinical-findings" className="scroll-mt-20">
      <Section title={<span className="flex items-center gap-2">Clinical Findings <EditHint /></span>}>
        <Grid>
          <EditableItem
            label="Diagnosis"
            value={draft.clinical_findings.diagnosis}
            onSave={v => updateClinicalField('diagnosis', v)}
            placeholder="e.g., Generalized Stage III, Grade B periodontitis"
            full
          />
          {QUADRANTS.map(q => (
            <EditableItem
              key={q.key}
              label={`Probing ${q.clinicalKey} (${q.label})`}
              value={draft.clinical_findings.probing_depths?.[q.clinicalKey]}
              onSave={v => updateProbingDepth(q.clinicalKey, v)}
              placeholder="e.g., 5-8mm"
            />
          ))}
          <EditableItem
            label="Bleeding on Probing"
            value={draft.clinical_findings.bop_percentage}
            onSave={v => updateClinicalField('bop_percentage', v)}
            placeholder="e.g., 82"
            type="number"
            suffix="%"
          />
          <EditableItem
            label="Bone Loss"
            value={draft.clinical_findings.bone_loss}
            onSave={v => updateClinicalField('bone_loss', v)}
            placeholder="e.g., Moderate horizontal, 3-4mm"
          />
          <EditableDateItem
            label="Last Prophylaxis"
            value={draft.clinical_findings.last_prophy_date}
            onSave={v => updateClinicalField('last_prophy_date', v)}
          />
          <div>
            <div className="text-xs text-text-muted mb-1">Prior Perio Treatment</div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!draft.clinical_findings.prior_perio_treatment}
                onChange={e => updateClinicalField('prior_perio_treatment', e.target.checked)}
              />
              <span className="text-sm text-text-strong">Patient has had prior SRP or surgery</span>
            </label>
            {draft.clinical_findings.prior_perio_treatment && (
              <div className="mt-2">
                <DateField
                  className={inlineDateCls}
                  value={draft.clinical_findings.prior_perio_date}
                  onChange={e => updateClinicalField('prior_perio_date', e.target.value)}
                />
              </div>
            )}
          </div>
          <EditableItem
            label="Additional Notes"
            value={draft.clinical_findings.additional_notes}
            onSave={v => updateClinicalField('additional_notes', v)}
            placeholder="Other findings — calculus, furcation, recession, mobility…"
            multiline
            full
          />
        </Grid>
      </Section>
      </div>

      {/* Clinical Narrative — inline editable. Editing un-approves; click Approve to re-approve. */}
      <div id="narrative" className="scroll-mt-20">
      <Section title={
        <span className="flex items-center gap-2">
          Clinical Narrative
          {draft.narrative_approved && (
            <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
              <Check size={14} /> Approved
            </span>
          )}
          <EditHint />
        </span>
      }>
        <InlineNarrative
          value={draft.generated_narrative}
          approved={draft.narrative_approved}
          onSave={updateNarrative}
          onApprove={approveNarrative}
        />
      </Section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this claim?"
        message="This permanently removes the claim and all of its data."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        message="You have unsaved edits. Discarding will revert them to what's currently saved."
        confirmLabel="Discard"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={onDiscardEdits}
      />
      <ConfirmDialog
        open={confirmRefresh}
        title="Refresh requirements?"
        message="This will reset your checklist. Are you sure?"
        confirmLabel="Refresh"
        danger
        onCancel={() => setConfirmRefresh(false)}
        onConfirm={onRefreshRequirements}
      />
      {submitOpen && <SubmitModal claim={claim} onCancel={() => setSubmitOpen(false)} onConfirm={onMarkSubmitted} />}
      {outcomeOpen && <OutcomeModal onCancel={() => setOutcomeOpen(false)} onConfirm={onLogOutcome} />}
      <PrintView open={printOpen} onClose={() => setPrintOpen(false)} claim={claim} payer={payer} settings={settings} cdtCodes={cdtCodes} />
      <CostEstimatePrintView
        open={costPrintOpen}
        onClose={() => setCostPrintOpen(false)}
        patientName={claim.patient_name}
        procedures={claim.procedures}
        costEstimate={draft.cost_estimate}
        settings={settings}
        cdtCodes={cdtCodes}
        payerName={payer?.name}
      />

      {/* === Floating save bar — only when there are unsaved inline edits. === */}
      {isDirty && (
        <FloatingSaveBar
          onSave={onSaveDraftEdits}
          onDiscard={() => setConfirmDiscard(true)}
        />
      )}

      <UnsavedChangesDialog
        blocker={blocker}
        onSave={() => saveClaim(draft)}
        onSaveError={() => show('Save failed', 'error')}
      />
    </div>
  )
}

function FloatingSaveBar({ onSave, onDiscard }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-navy text-cream-light shadow-2xl rounded-full px-5 py-3 flex items-center gap-3 max-w-[calc(100vw-2rem)]">
      <span className="text-sm">You have unsaved changes</span>
      <div className="flex gap-2">
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 text-sm border border-cream-light/30 rounded-full text-cream-light/90 hover:bg-cream-light/10"
        >
          Discard
        </button>
        <button
          onClick={onSave}
          className="px-4 py-1.5 text-sm bg-teal text-white font-medium rounded-full hover:opacity-90"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

// === Prominent status flow — big status pill + obvious next-action button. ===
function StatusFlow({ status, outcome, outcomeDate, denialReason, score, onMarkReady, onMarkSubmitted, onLogOutcome }) {
  const STATUS_DISPLAY = {
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-700' },
    ready:     { label: 'Ready',     cls: 'bg-teal/15 text-teal' },
    submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
    paid:      { label: 'Paid',      cls: 'bg-success/15 text-success' },
    denied:    { label: 'Denied',    cls: 'bg-danger/15 text-danger' },
    pended:    { label: 'Pended',    cls: 'bg-warning/15 text-yellow-700' },
  }
  const s = STATUS_DISPLAY[status] || STATUS_DISPLAY.draft

  // Next-action button per status. Big, prominent, always visible.
  let action = null
  if (status === 'draft') {
    action = (
      <button
        onClick={onMarkReady}
        disabled={score !== 'green'}
        title={score !== 'green' ? 'Complete the requirements checklist + approve narrative first.' : ''}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-cream-light text-sm font-medium rounded-full hover:opacity-90 disabled:opacity-40"
      >
        <Check size={16} /> Mark as Ready
      </button>
    )
  } else if (status === 'ready') {
    action = (
      <button
        onClick={onMarkSubmitted}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-cream-light text-sm font-medium rounded-full hover:opacity-90"
      >
        <Send size={16} /> Mark as Submitted
      </button>
    )
  } else if (status === 'submitted') {
    action = (
      <button
        onClick={onLogOutcome}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-medium rounded-full hover:opacity-90"
      >
        <ClipboardCheck size={16} /> Log Outcome
      </button>
    )
  }

  return (
    <div className="mt-5 flex items-center justify-between gap-4 flex-wrap p-4 bg-cream-light rounded-lg border border-border-warm">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Status</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.cls}`}>
          {s.label}
        </span>
        {outcome && (
          <span className="text-sm text-text-muted">
            {outcomeDate && `on ${formatDate(outcomeDate)}`}
            {denialReason && ` — ${denialReason}`}
          </span>
        )}
      </div>
      {action}
    </div>
  )
}

function SecondaryActions({ status, onEdit, onDelete, onPrint }) {
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border-warm rounded-full text-text-strong hover:bg-cream-light'
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onEdit} className={btn}><Pencil size={14} /> Edit in Wizard</button>
      <button onClick={onPrint} className={btn}><FileDown size={14} /> Generate PDF</button>
      {status === 'draft' && (
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-danger/40 text-danger rounded-full hover:bg-danger/5">
          <Trash2 size={14} /> Delete
        </button>
      )}
    </div>
  )
}

function SubmitModal({ claim, onCancel, onConfirm }) {
  const [date, setDate] = useState(claim.submission_date || todayIso())
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-text-strong">Mark as Submitted</h3>
        <p className="text-sm text-text-muted mt-1">When was this claim submitted to the payer?</p>
        <DateField value={date} onChange={e => setDate(e.target.value)}
          className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-text-muted hover:bg-gray-50">Cancel</button>
          <button onClick={() => onConfirm(date)} className="px-4 py-2 text-sm bg-navy text-white rounded-md hover:opacity-90">Confirm</button>
        </div>
      </div>
    </div>
  )
}

function OutcomeModal({ onCancel, onConfirm }) {
  const [outcome, setOutcome] = useState('paid')
  const [reason, setReason] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [notes, setNotes] = useState('')

  const finalReason = reason === 'Other' ? (otherReason || 'Other') : reason

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-text-strong">Log Outcome</h3>

        <div className="mt-4 flex gap-3">
          {['paid', 'denied', 'pended'].map(o => (
            <label key={o} className={`flex-1 px-3 py-2 border rounded-md text-center text-sm capitalize cursor-pointer ${outcome === o ? 'border-navy bg-navy text-white' : 'border-gray-300 text-text-muted hover:bg-gray-50'}`}>
              <input type="radio" className="hidden" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
              {o}
            </label>
          ))}
        </div>

        {(outcome === 'denied' || outcome === 'pended') && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-text-strong mb-1">Reason</span>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">Select a reason…</option>
                {DENIAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            {reason === 'Other' && (
              <label className="block">
                <span className="block text-sm font-medium text-text-strong mb-1">Specify reason</span>
                <input value={otherReason} onChange={e => setOtherReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </label>
            )}
          </div>
        )}

        <label className="block mt-4">
          <span className="block text-sm font-medium text-text-strong mb-1">Additional Notes</span>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </label>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-text-muted hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onConfirm({ outcome, denial_reason: finalReason, denial_notes: notes })}
            disabled={outcome !== 'paid' && !finalReason}
            className="px-4 py-2 text-sm bg-navy text-white rounded-md hover:opacity-90 disabled:opacity-40">
            Save Outcome
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Denial-feedback loop ----------

function findItemMatchingReason(items, reason) {
  if (!reason) return null
  const r = reason.toLowerCase()
  const tests = [
    { rx: /radiograph|x-?ray|image|mouth series/, target: /radiograph|image|mouth series|periapical/i },
    { rx: /narrative|medical necessity/, target: /narrative|medical necessity/i },
    { rx: /charting/, target: /charting/i },
    { rx: /pre-?auth|authoriz/, target: /pre-?auth|authoriz/i },
    { rx: /frequency/, target: /frequency|prophylaxis|maintenance/i },
    { rx: /bundling/, target: /bundling/i },
    { rx: /downgrad/, target: /downgrad/i },
    { rx: /perio/, target: /perio/i },
  ]
  for (const t of tests) {
    if (t.rx.test(r)) {
      const match = items.find(it => t.target.test(it.item))
      if (match) return match
    }
  }
  return null
}

async function runDenialFeedback({ newClaim, allClaims, requirements, saveRequirement, show }) {
  const reason = newClaim.denial_reason
  if (!reason) return
  for (const proc of newClaim.procedures || []) {
    if (!proc.cdt_code) continue
    // Count denials for this payer + code + reason across all claims (including this one)
    const count = allClaims.filter(c =>
      c.outcome === 'denied'
      && c.payer_id === newClaim.payer_id
      && c.denial_reason === reason
      && (c.procedures || []).some(p => p.cdt_code === proc.cdt_code)
    ).length

    if (count < 2) continue

    const req = requirements.find(r => r.payer_id === newClaim.payer_id && r.cdt_code === proc.cdt_code)
    if (!req) continue

    const item = findItemMatchingReason(req.required_documents, reason)
    if (!item) continue
    if (item.denial_risk === 'high') continue

    const updated = {
      ...req,
      required_documents: req.required_documents.map(d =>
        d.item === item.item ? { ...d, denial_risk: 'high' } : d
      ),
    }
    await saveRequirement(updated)
    show(`Payer requirement updated: "${item.item}" is now flagged as high-risk for ${newClaim.payer_id} + ${proc.cdt_code}.`, 'warning')
  }
}

// ---------- Layout helpers ----------

// Patient Cost Estimate — a brighter card than ordinary Sections so it pulls
// the eye on the report page. Shows an explicit empty-state CTA when the user
// hasn't filled out the estimate yet; flips to the full editor on click.
function PatientCostEstimateCard({ procedures, cdtCodes, value, onChange, onPrint }) {
  const filled = hasCostEstimateData(value)
  const [expanded, setExpanded] = useState(filled)

  if (!expanded) {
    return (
      <div className="rounded-xl border-2 border-teal/40 bg-teal/5 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="shrink-0 p-3 rounded-full bg-teal/15 text-teal">
            <Calculator size={28} strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-2xl text-text-strong leading-tight">Patient Cost Estimate</h2>
            <p className="text-sm text-text-muted mt-1.5 max-w-xl">
              Estimate the patient's out-of-pocket and what insurance will cover, using their plan's deductible, max benefit, and coinsurance. Print as a treatment plan to hand to the patient.
            </p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-medium rounded-full hover:opacity-90"
          >
            <Calculator size={16} /> Add Cost Estimate
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="bg-white border-2 border-teal/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="shrink-0 p-2 rounded-full bg-teal/15 text-teal">
          <Calculator size={20} strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-2xl text-text-strong leading-tight">Patient Cost Estimate</h2>
          <p className="text-xs text-text-muted mt-0.5">Click any field to edit · Print to hand to the patient</p>
        </div>
      </div>
      <CostEstimatorPanel
        procedures={procedures}
        cdtCodes={cdtCodes}
        value={value}
        onChange={onChange}
        onPrint={onPrint}
      />
    </section>
  )
}

function Section({ title, children }) {
  return (
    <section className="bg-white border border-border-warm rounded-lg p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">{children}</div>
}

function HeaderStat({ label, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="text-text-strong text-sm mt-1 leading-snug">{children}</div>
    </div>
  )
}

function EditHint() {
  return <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70 ml-1">— click any field to edit</span>
}

// ---------- Inline-editable field primitives ----------
//
// These look like plain text by default. Hover or focus reveals a soft border /
// cream background so the user knows the field is editable; tabbing in keeps the
// input as plain text (no popups). Saves are debounced to blur (text/textarea)
// or fire on change (date/checkbox).

const inlineFieldCls =
  'w-full px-2 py-1 text-sm bg-transparent border border-transparent rounded transition-colors ' +
  'hover:bg-cream-light hover:border-border-warm ' +
  'focus:bg-white focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'

const inlineDateCls = inlineFieldCls + ' max-w-[180px]'

function EditableItem({ label, value, onSave, type = 'text', placeholder, suffix, multiline, full }) {
  const [draft, setDraft] = useState(value ?? '')
  // Re-sync local draft if the upstream value changes (e.g. saved from another control).
  useEffect(() => { setDraft(value ?? '') }, [value])

  const onBlur = () => {
    const next = draft
    if ((value ?? '') !== next) onSave(next)
  }

  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="relative flex items-center">
        {multiline ? (
          <textarea
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={inlineFieldCls + ' resize-y'}
          />
        ) : (
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={inlineFieldCls + (suffix ? ' pr-7' : '')}
          />
        )}
        {suffix && !multiline && (
          <span className="pointer-events-none absolute right-2 text-text-muted text-xs">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function EditableDateItem({ label, value, onSave }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <DateField
        className={inlineDateCls}
        value={value}
        onChange={e => onSave(e.target.value)}
      />
    </div>
  )
}

function InlineNarrative({ value, approved, onSave, onApprove }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])
  const onBlur = () => {
    if ((value ?? '') !== draft) onSave(draft)
  }
  return (
    <div className="space-y-3">
      <textarea
        rows={Math.max(8, Math.min(20, (draft.match(/\n/g) || []).length + 6))}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={onBlur}
        placeholder="No narrative yet — paste or write one here. It saves automatically."
        className={inlineFieldCls + ' font-serif text-base leading-relaxed resize-y min-h-[160px]'}
      />
      {!approved && draft.trim() && (
        <button
          onClick={onApprove}
          className="px-3.5 py-1.5 text-sm bg-success text-white rounded-full hover:opacity-90"
        >
          Approve Narrative
        </button>
      )}
    </div>
  )
}
