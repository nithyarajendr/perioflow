import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, FileText } from 'lucide-react'
import { useData } from '../lib/DataContext'
import StatusBadge from '../components/StatusBadge'
import { formatDate, formatMoney } from '../lib/utils'

export default function Dashboard() {
  const { claims, getPayer } = useData()
  const navigate = useNavigate()

  const stats = useMemo(() => computeStats(claims), [claims])
  const sortedClaims = useMemo(
    () => [...claims].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [claims]
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-text-strong">Dashboard</h1>
        <p className="text-text-muted mt-1">Overview of all claims.</p>
      </header>

      {/* === Hero New Claim CTA — the obvious primary action on the page. === */}
      <section className="bg-navy text-cream-light rounded-xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-2xl">Start a new claim</h2>
          <p className="text-cream-light/75 text-sm mt-1.5 max-w-xl">
            Auto-filled fees, AI-suggested payer requirements, and ready-to-submit packets in a few minutes.
          </p>
        </div>
        <Link
          to="/new-claim"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-teal text-white rounded-full text-base font-semibold hover:opacity-90 transition shadow-md shrink-0"
        >
          <PlusCircle size={20} /> New Claim
        </Link>
      </section>

      {/* === Three stat cards (Claims This Month removed) === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Claims" value={stats.total} />
        <StatCard label="Pending Outcome" value={stats.pending} />
        <StatCard
          label="Denial Rate"
          value={stats.denialRateLabel}
          valueClass={stats.denialRate > 0.15 ? 'text-danger' : 'text-text-strong'}
        />
      </div>

      <section>
        <div className="bg-white border border-border-warm rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-light text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Patient</th>
                <th className="px-4 py-2.5">Payer</th>
                <th className="px-4 py-2.5">Procedures</th>
                <th className="px-4 py-2.5">Total Fee</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-warm">
              {sortedClaims.map(c => (
                <tr
                  key={c.claim_id}
                  className="hover:bg-cream-light cursor-pointer"
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
                    <FileText className="mx-auto text-text-muted/50 mb-3" size={36} />
                    <p className="text-text-strong font-medium">No claims yet</p>
                    <p className="text-sm text-text-muted mt-1">Click <strong>New Claim</strong> above to get started.</p>
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
    <div className="bg-white border border-border-warm rounded-lg p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className={`font-serif text-3xl mt-1.5 ${valueClass}`}>{value}</div>
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
  return { total, pending, denialRate, denialRateLabel }
}
