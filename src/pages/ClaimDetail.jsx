import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Send, FileDown, ClipboardCheck, AlertTriangle, Check } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { useToast } from '../components/Toast'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import PrintView from '../components/PrintView'
import {
  formatDate,
  formatMoney,
  todayIso,
  getRequirementsForClaim,
  computeHealthScore,
  DENIAL_REASONS,
  QUADRANTS,
} from '../lib/utils'

export default function ClaimDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { claims, getPayer, settings, cdtCodes, requirements, saveClaim, deleteClaim, saveRequirement } = useData()
  const { show } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const claim = claims.find(c => c.claim_id === id)
  const payer = claim ? getPayer(claim.payer_id) : null
  const requirementGroups = useMemo(
    () => claim ? getRequirementsForClaim(claim, requirements, cdtCodes) : [],
    [claim, requirements, cdtCodes]
  )
  const score = useMemo(() => claim ? computeHealthScore(claim, requirementGroups) : null, [claim, requirementGroups])

  if (!claim) {
    return (
      <div className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-navy"><ArrowLeft size={14} /> Back to Dashboard</Link>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-text-strong font-medium">Claim not found</p>
          <p className="text-sm text-text-muted mt-1">No claim with id <span className="font-mono">{id}</span>.</p>
        </div>
      </div>
    )
  }

  const checked = new Set(claim.checklist || [])

  const onMarkSubmitted = async (date) => {
    try {
      await saveClaim({ ...claim, status: 'submitted', submission_date: date })
      show('Claim marked as submitted', 'success')
      setSubmitOpen(false)
    } catch {
      show('Failed to update claim', 'error')
    }
  }

  const onLogOutcome = async ({ outcome, denial_reason, denial_notes }) => {
    const next = {
      ...claim,
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
      // Denial-feedback loop: if denied, check & possibly upgrade requirement
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
    try {
      await deleteClaim(claim.claim_id)
      show('Claim deleted', 'success')
      navigate('/')
    } catch {
      show('Delete failed', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-navy mb-2"><ArrowLeft size={14} /> Back to Dashboard</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-strong">{claim.patient_name || 'Untitled Claim'}</h1>
            <StatusBadge status={claim.status} />
          </div>
          <p className="text-text-muted text-sm mt-1">
            <span className="font-mono">{claim.claim_id}</span> · created {formatDate(claim.created_at)}
          </p>
        </div>
        <ActionButtons
          status={claim.status}
          onEdit={() => navigate(`/new-claim?id=${claim.claim_id}`)}
          onDelete={() => setConfirmDelete(true)}
          onMarkSubmitted={() => setSubmitOpen(true)}
          onLogOutcome={() => setOutcomeOpen(true)}
          onPrint={() => setPrintOpen(true)}
        />
      </div>

      {claim.outcome && (
        <OutcomeBanner claim={claim} />
      )}

      <Section title="Patient & Insurance">
        <Grid>
          <Item label="Patient">{claim.patient_name || '—'}</Item>
          <Item label="Date of Service">{formatDate(claim.date_of_service)}</Item>
          <Item label="Payer">{payer?.name || claim.payer_id || '—'}</Item>
          <Item label="Plan Type">{payer?.plan_type || '—'}</Item>
        </Grid>
      </Section>

      <Section title="Procedures">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2">CDT</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2 text-right">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
            <tr className="border-t-2 border-gray-200">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-text-strong">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-text-strong">{formatMoney(claim.total_fee)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      <Section title="Clinical Findings">
        <Grid>
          <Item label="Diagnosis" full>{claim.clinical_findings.diagnosis || '—'}</Item>
          {QUADRANTS.map(q => (
            <Item key={q.key} label={`Probing ${q.clinicalKey} (${q.label})`}>
              {claim.clinical_findings.probing_depths?.[q.clinicalKey] || '—'}
            </Item>
          ))}
          <Item label="Bleeding on Probing">{claim.clinical_findings.bop_percentage ? `${claim.clinical_findings.bop_percentage}%` : '—'}</Item>
          <Item label="Bone Loss">{claim.clinical_findings.bone_loss || '—'}</Item>
          <Item label="Last Prophylaxis">{formatDate(claim.clinical_findings.last_prophy_date) || '—'}</Item>
          <Item label="Prior Perio Treatment">
            {claim.clinical_findings.prior_perio_treatment
              ? `Yes${claim.clinical_findings.prior_perio_date ? ` (${formatDate(claim.clinical_findings.prior_perio_date)})` : ''}`
              : 'No'}
          </Item>
          <Item label="Additional Notes" full>{claim.clinical_findings.additional_notes || '—'}</Item>
        </Grid>
      </Section>

      <Section title={
        <span className="flex items-center gap-2">
          Clinical Narrative
          {claim.narrative_approved && <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><Check size={14} /> Approved</span>}
        </span>
      }>
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-text-strong">
          {claim.generated_narrative || <span className="italic text-text-muted">No narrative recorded.</span>}
        </p>
      </Section>

      <Section title="Documentation Checklist">
        <div className="space-y-3">
          {requirementGroups.map((g, gi) => (
            <div key={gi} className="border border-gray-200 rounded-md p-3">
              <div className="text-xs uppercase tracking-wider text-text-muted mb-2">{g.cdt_code}</div>
              <ul className="space-y-1">
                {g.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1 inline-block w-3 h-3 rounded-sm border ${checked.has(it.item) ? 'bg-success border-success' : 'border-gray-300'}`}>
                      {checked.has(it.item) && <Check size={10} className="text-white" />}
                    </span>
                    <span className={checked.has(it.item) ? 'text-text-strong' : 'text-text-muted'}>{it.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {score && <p className="text-xs text-text-muted mt-3">Claim Health Score: <strong className={
          score === 'green' ? 'text-success' : score === 'yellow' ? 'text-yellow-700' : 'text-danger'
        }>{score === 'green' ? 'Ready' : score === 'yellow' ? 'Recommended items missing' : 'Required items missing'}</strong></p>}
      </Section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this claim?"
        message="This permanently removes the claim and all of its data."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
      {submitOpen && <SubmitModal claim={claim} onCancel={() => setSubmitOpen(false)} onConfirm={onMarkSubmitted} />}
      {outcomeOpen && <OutcomeModal onCancel={() => setOutcomeOpen(false)} onConfirm={onLogOutcome} />}
      <PrintView open={printOpen} onClose={() => setPrintOpen(false)} claim={claim} payer={payer} settings={settings} cdtCodes={cdtCodes} />
    </div>
  )
}

function ActionButtons({ status, onEdit, onDelete, onMarkSubmitted, onLogOutcome, onPrint }) {
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md hover:opacity-90'
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'draft' && (
        <>
          <button onClick={onEdit} className={`${btn} bg-navy text-white`}><Pencil size={14} /> Edit Claim</button>
          <button onClick={onDelete} className={`${btn} border border-danger/40 text-danger`}><Trash2 size={14} /> Delete</button>
        </>
      )}
      {status === 'ready' && (
        <>
          <button onClick={onEdit} className={`${btn} border border-gray-300 text-text-strong`}><Pencil size={14} /> Edit</button>
          <button onClick={onMarkSubmitted} className={`${btn} bg-navy text-white`}><Send size={14} /> Mark as Submitted</button>
          <button onClick={onPrint} className={`${btn} border border-gray-300 text-text-strong`}><FileDown size={14} /> Generate PDF</button>
        </>
      )}
      {status === 'submitted' && (
        <>
          <button onClick={onLogOutcome} className={`${btn} bg-teal text-white`}><ClipboardCheck size={14} /> Log Outcome</button>
          <button onClick={onPrint} className={`${btn} border border-gray-300 text-text-strong`}><FileDown size={14} /> Generate PDF</button>
        </>
      )}
      {(status === 'paid' || status === 'denied' || status === 'pended') && (
        <button onClick={onPrint} className={`${btn} border border-gray-300 text-text-strong`}><FileDown size={14} /> Generate PDF</button>
      )}
    </div>
  )
}

function OutcomeBanner({ claim }) {
  const cls = claim.outcome === 'paid' ? 'bg-success/10 border-success/40 text-success' :
              claim.outcome === 'denied' ? 'bg-danger/10 border-danger/40 text-danger' :
              'bg-warning/10 border-warning/40 text-yellow-800'
  return (
    <div className={`border rounded-md p-4 ${cls}`}>
      <div className="flex items-start gap-2">
        {claim.outcome === 'paid' ? <Check size={18} className="mt-0.5" /> : <AlertTriangle size={18} className="mt-0.5" />}
        <div>
          <div className="font-semibold capitalize">{claim.outcome}{claim.outcome_date ? ` on ${formatDate(claim.outcome_date)}` : ''}</div>
          {claim.denial_reason && <div className="text-sm">Reason: {claim.denial_reason}</div>}
          {claim.denial_notes && <div className="text-sm opacity-80 mt-1">{claim.denial_notes}</div>}
        </div>
      </div>
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
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
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

function Section({ title, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">{children}</div>
}

function Item({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-text-strong">{children}</div>
    </div>
  )
}
