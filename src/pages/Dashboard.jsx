import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, AlertTriangle } from 'lucide-react'
import { useData } from '../lib/DataContext'
import StatusBadge from '../components/StatusBadge'
import { formatDate, formatMoney } from '../lib/utils'

export default function Dashboard() {
  const { claims, payers, getPayer } = useData()
  const navigate = useNavigate()

  const stats = useMemo(() => computeStats(claims), [claims])
  const denialAlerts = useMemo(() => computeDenialAlerts(claims, payers), [claims, payers])
  const sortedClaims = useMemo(
    () => [...claims].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [claims]
  )

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-strong">Dashboard</h1>
          <p className="text-text-muted mt-1">Overview of all claims and any payer/procedure denial trends.</p>
        </div>
        <Link to="/new-claim" className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-md text-sm font-medium hover:opacity-90 shadow-sm">
          <PlusCircle size={16} /> New Claim
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Claims" value={stats.total} />
        <StatCard label="Pending Outcome" value={stats.pending} />
        <StatCard label="Denial Rate" value={stats.denialRateLabel} valueClass={stats.denialRate > 0.15 ? 'text-danger' : 'text-text-strong'} />
        <StatCard label="Claims This Month" value={stats.thisMonth} />
      </div>

      {denialAlerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-strong uppercase tracking-wider">Denial Alerts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {denialAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 p-3 border border-warning/40 bg-warning/10 rounded-md text-sm">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-yellow-700" />
                <div>
                  <div className="font-medium text-text-strong">
                    {a.payerName} + {a.code}: {Math.round(a.rate * 100)}% denial rate
                    <span className="text-text-muted font-normal"> ({a.denied} of {a.total} claims)</span>
                  </div>
                  {a.topReason && <div className="text-xs text-text-muted mt-0.5">Most common reason: {a.topReason}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Patient</th>
                <th className="px-4 py-2.5">Payer</th>
                <th className="px-4 py-2.5">Procedures</th>
                <th className="px-4 py-2.5">Total Fee</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedClaims.map(c => (
                <tr
                  key={c.claim_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/claims/${c.claim_id}`)}
                >
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{formatDate(c.date_of_service || c.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-text-strong">{c.patient_name || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{getPayer(c.payer_id)?.name || c.payer_id}</td>
                  <td className="px-4 py-3 text-text-muted">{c.procedures.map(p => p.cdt_code).filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-text-strong whitespace-nowrap">{formatMoney(c.total_fee)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
              {sortedClaims.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileText className="mx-auto text-gray-300 mb-3" size={36} />
                    <p className="text-text-strong font-medium">No claims yet</p>
                    <p className="text-sm text-text-muted mt-1">Create your first claim to get started.</p>
                    <Link to="/new-claim" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-md text-sm">
                      <PlusCircle size={16} /> New Claim
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-text-strong' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</div>
    </div>
  )
}

function computeStats(claims) {
  const total = claims.length
  const pending = claims.filter(c => c.status === 'submitted' && !c.outcome).length
  const withOutcome = claims.filter(c => c.outcome)
  const denied = claims.filter(c => c.outcome === 'denied')
  const denialRate = withOutcome.length > 0 ? denied.length / withOutcome.length : 0
  const denialRateLabel = withOutcome.length > 0 ? `${Math.round(denialRate * 100)}%` : '—'
  const now = new Date()
  const thisMonth = claims.filter(c => {
    const d = new Date(c.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  return { total, pending, denialRate, denialRateLabel, thisMonth }
}

function computeDenialAlerts(claims, payers) {
  const buckets = new Map()
  for (const c of claims) {
    if (!c.outcome) continue
    for (const proc of c.procedures || []) {
      if (!proc.cdt_code) continue
      const key = `${c.payer_id}__${proc.cdt_code}`
      if (!buckets.has(key)) buckets.set(key, { payerId: c.payer_id, code: proc.cdt_code, total: 0, denied: 0, reasons: {} })
      const b = buckets.get(key)
      b.total += 1
      if (c.outcome === 'denied') {
        b.denied += 1
        const reason = c.denial_reason || 'Unknown'
        b.reasons[reason] = (b.reasons[reason] || 0) + 1
      }
    }
  }
  const out = []
  for (const b of buckets.values()) {
    const rate = b.total > 0 ? b.denied / b.total : 0
    if (rate > 0.3 && b.denied > 0) {
      const topReason = Object.entries(b.reasons).sort((a, b) => b[1] - a[1])[0]?.[0]
      const payer = payers.find(p => p.payer_id === b.payerId)
      out.push({ payerName: payer?.name || b.payerId, code: b.code, rate, denied: b.denied, total: b.total, topReason })
    }
  }
  return out.sort((a, b) => b.rate - a.rate)
}
