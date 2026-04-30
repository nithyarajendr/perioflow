import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, BarChart3 } from 'lucide-react'
import { useData } from '../lib/DataContext'

export default function DenialInsights() {
  const { claims, payers } = useData()

  const aggregate = useMemo(() => buildAggregate(claims, payers), [claims, payers])

  if (aggregate.totalWithOutcome === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-strong">Denial Insights</h1>
          <p className="text-text-muted mt-1">Analytics on submitted claim outcomes.</p>
        </header>
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <BarChart3 className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-text-strong font-medium">No claim outcomes logged yet</p>
          <p className="text-sm text-text-muted mt-1">Submit claims and log their outcomes to see denial patterns.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-strong">Denial Insights</h1>
        <p className="text-text-muted mt-1">Analytics on submitted claim outcomes.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Denials" value={aggregate.totalDenied} />
        <StatCard label="Overall Denial Rate" value={`${Math.round(aggregate.overallRate * 100)}%`} valueClass={aggregate.overallRate > 0.15 ? 'text-danger' : 'text-text-strong'} />
        <StatCard label="Most Common Reason" value={aggregate.topReason || '—'} small />
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Denial Rate by Payer</h2>
        <ul className="space-y-3">
          {aggregate.byPayer.map((d, i) => {
            const color = d.ratePct > 20 ? 'bg-danger' : d.ratePct >= 10 ? 'bg-warning' : 'bg-success'
            return (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-text-strong truncate">{d.payerName}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div className={`h-full ${color} transition-all`} style={{ width: `${d.ratePct}%` }} />
                </div>
                <span className="w-12 text-right font-medium text-text-strong">{d.ratePct}%</span>
                <span className="w-24 text-right text-xs text-text-muted">{d.denied} of {d.total}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <BreakdownTable rows={aggregate.breakdown} />
    </div>
  )
}

function StatCard({ label, value, small = false, valueClass = 'text-text-strong' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`${small ? 'text-base mt-2' : 'text-2xl mt-1'} font-semibold ${valueClass}`}>{value}</div>
    </div>
  )
}

function BreakdownTable({ rows }) {
  const [sortKey, setSortKey] = useState('rate')
  const [sortDir, setSortDir] = useState('desc')
  const sorted = useMemo(() => {
    const out = [...rows]
    out.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const sv = String(av || ''), sv2 = String(bv || '')
      return sortDir === 'asc' ? sv.localeCompare(sv2) : sv2.localeCompare(sv)
    })
    return out
  }, [rows, sortKey, sortDir])

  const toggle = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const Th = ({ k, children, className = '' }) => (
    <th className={`px-3 py-2 cursor-pointer select-none ${className}`} onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  )

  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <h2 className="px-5 pt-4 text-sm font-semibold uppercase tracking-wider text-text-muted">Denial Breakdown</h2>
      <table className="w-full text-sm mt-3">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-text-muted">
          <tr>
            <Th k="payerName">Payer</Th>
            <Th k="code">CDT Code</Th>
            <Th k="total">Total Claims</Th>
            <Th k="denied">Denied</Th>
            <Th k="rate">Denial Rate</Th>
            <th className="px-3 py-2">Top Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r, i) => (
            <tr key={i}>
              <td className="px-3 py-2 font-medium text-text-strong">{r.payerName}</td>
              <td className="px-3 py-2 font-mono text-text-muted">{r.code}</td>
              <td className="px-3 py-2 text-text-muted">{r.total}</td>
              <td className="px-3 py-2 text-text-muted">{r.denied}</td>
              <td className={`px-3 py-2 font-medium ${r.rate > 0.2 ? 'text-danger' : r.rate >= 0.1 ? 'text-yellow-700' : 'text-success'}`}>
                {Math.round(r.rate * 100)}%
              </td>
              <td className="px-3 py-2 text-text-muted">{r.topReason || '—'}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-text-muted">No outcomes recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function buildAggregate(claims, payers) {
  const withOutcome = claims.filter(c => c.outcome)
  const denied = withOutcome.filter(c => c.outcome === 'denied')

  // Most common reason
  const reasonCounts = {}
  for (const c of denied) {
    const r = c.denial_reason || 'Unknown'
    reasonCounts[r] = (reasonCounts[r] || 0) + 1
  }
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // By payer (rate)
  const payerBuckets = new Map()
  for (const c of withOutcome) {
    const k = c.payer_id
    if (!payerBuckets.has(k)) payerBuckets.set(k, { total: 0, denied: 0 })
    const b = payerBuckets.get(k)
    b.total += 1
    if (c.outcome === 'denied') b.denied += 1
  }
  const byPayer = Array.from(payerBuckets.entries())
    .map(([payer_id, v]) => ({
      payerName: payers.find(p => p.payer_id === payer_id)?.name || payer_id,
      ratePct: v.total > 0 ? Math.round((v.denied / v.total) * 100) : 0,
      total: v.total,
      denied: v.denied,
    }))
    .sort((a, b) => b.ratePct - a.ratePct)

  // Breakdown by payer + code
  const buckets = new Map()
  for (const c of withOutcome) {
    for (const p of c.procedures || []) {
      if (!p.cdt_code) continue
      const k = `${c.payer_id}__${p.cdt_code}`
      if (!buckets.has(k)) buckets.set(k, { payer_id: c.payer_id, code: p.cdt_code, total: 0, denied: 0, reasons: {} })
      const b = buckets.get(k)
      b.total += 1
      if (c.outcome === 'denied') {
        b.denied += 1
        const r = c.denial_reason || 'Unknown'
        b.reasons[r] = (b.reasons[r] || 0) + 1
      }
    }
  }
  const breakdown = Array.from(buckets.values()).map(b => ({
    payerName: payers.find(p => p.payer_id === b.payer_id)?.name || b.payer_id,
    code: b.code,
    total: b.total,
    denied: b.denied,
    rate: b.total > 0 ? b.denied / b.total : 0,
    topReason: Object.entries(b.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  }))

  return {
    totalWithOutcome: withOutcome.length,
    totalDenied: denied.length,
    overallRate: withOutcome.length > 0 ? denied.length / withOutcome.length : 0,
    topReason,
    byPayer,
    breakdown,
  }
}
