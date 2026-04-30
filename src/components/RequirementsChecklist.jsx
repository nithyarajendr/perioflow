import { Check, CheckCircle2, AlertTriangle, AlertOctagon, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useData } from '../lib/DataContext'

/**
 * Documentation Requirements — the most important surface in PerioFlow.
 * Used in two places with the same visual language:
 *   • New Claim wizard, Review step (interactive: onToggle is wired)
 *   • Claim Detail page (interactive too, with floating save bar)
 *
 * Group source values:
 *   'payer'        — practice/saved entry from perioflow:payer-requirements
 *   'ai-suggested' — Claude generated this on the fly (offer to save)
 *   'ai-loading'   — fetching from Claude
 *   'ai-error'     — fetch failed (offer retry)
 */
// Default export — renders all three sub-pieces stacked.
// Used by the wizard's review step (one logical block).
export default function RequirementsChecklist({ groups, checked, onToggle, score, readOnly = false, onSaveAi, onRetryAi }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="bg-white border border-border-warm rounded-lg p-6 text-center text-text-muted">
        Add a procedure to see the documentation requirements.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <RequirementsHealthSection groups={groups} checked={checked} score={score} />
      <RequirementsListSection
        groups={groups}
        checked={checked}
        onToggle={onToggle}
        readOnly={readOnly}
        onSaveAi={onSaveAi}
        onRetryAi={onRetryAi}
      />
    </div>
  )
}

// === Subparts (named exports) — used by Claim Detail to split the two
// pieces with separate TOC anchors. ===

export function RequirementsHealthSection({ groups, checked, score }) {
  if (!groups || groups.length === 0) return null
  const stats = computeChecklistStats(groups, checked)
  return (
    <HealthScoreCard
      score={score}
      requiredChecked={stats.requiredChecked}
      totalRequired={stats.requiredItems.length}
      anyLoading={stats.anyLoading}
      anyError={stats.anyError}
    />
  )
}

export function RequirementsListSection({ groups, checked, onToggle, readOnly = false, onSaveAi, onRetryAi }) {
  if (!groups || groups.length === 0) return null
  const stats = computeChecklistStats(groups, checked)
  return (
    <div className="space-y-4">
      <ProgressBar checked={stats.requiredChecked} total={stats.requiredItems.length} anyLoading={stats.anyLoading} />
      <ChecklistList
        groups={groups}
        checked={checked}
        onToggle={onToggle}
        readOnly={readOnly}
        onSaveAi={onSaveAi}
        onRetryAi={onRetryAi}
      />
    </div>
  )
}

function computeChecklistStats(groups, checked) {
  const resolvedItems = groups
    .filter(g => g.source === 'payer' || g.source === 'ai-suggested')
    .flatMap(g => g.items)
  const isReq = it => it.priority === 'required' || it.denial_risk === 'high'
  const requiredItems = resolvedItems.filter(isReq)
  const requiredChecked = requiredItems.filter(it => checked.has(it.item)).length
  const anyLoading = groups.some(g => g.source === 'ai-loading')
  const anyError = groups.some(g => g.source === 'ai-error')
  return { requiredItems, requiredChecked, anyLoading, anyError }
}

function HealthScoreCard({ score, requiredChecked, totalRequired, anyLoading, anyError }) {
  if (anyLoading) {
    return (
      <div className="flex items-start gap-4 p-6 rounded-xl border-2 bg-teal/10 border-teal/40">
        <div className="shrink-0 text-teal animate-spin"><Loader2 size={42} strokeWidth={1.4} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Claim Health Score</p>
          <h2 className="font-serif text-2xl mt-1 text-teal">Generating requirements…</h2>
          <p className="text-sm text-text-strong/85 mt-1.5 leading-relaxed">
            Asking Claude for payer-specific documentation requirements. This usually takes a few seconds.
          </p>
        </div>
      </div>
    )
  }

  if (anyError) {
    return (
      <div className="flex items-start gap-4 p-6 rounded-xl border-2 bg-warning/10 border-warning/50">
        <div className="shrink-0 text-warning"><AlertTriangle size={42} strokeWidth={1.4} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Claim Health Score</p>
          <h2 className="font-serif text-2xl mt-1 text-warning">Requirements unavailable</h2>
          <p className="text-sm text-text-strong/85 mt-1.5 leading-relaxed">
            Couldn't fetch payer-specific documentation requirements (see details below). Use Retry, or save the claim manually once requirements load.
          </p>
        </div>
      </div>
    )
  }

  const config = {
    green: {
      cls: 'bg-success/10 border-success/50',
      iconCls: 'text-success',
      Icon: CheckCircle2,
      title: 'Ready to submit',
      desc: 'All required documents are checked off and the narrative is approved.',
    },
    yellow: {
      cls: 'bg-warning/10 border-warning/50',
      iconCls: 'text-warning',
      Icon: AlertTriangle,
      title: 'Almost ready',
      desc: 'Required documents are ready. A few recommended items are still unchecked.',
    },
    red: {
      cls: 'bg-danger/10 border-danger/50',
      iconCls: 'text-danger',
      Icon: AlertOctagon,
      title: 'Action required',
      desc: totalRequired > 0
        ? `${totalRequired - requiredChecked} required item${totalRequired - requiredChecked === 1 ? '' : 's'} unchecked${requiredChecked > 0 ? ' — ' + requiredChecked + ' done' : ''}, and the narrative needs to be approved.`
        : 'Approve the narrative before submitting.',
    },
  }[score] || null

  if (!config) return null
  const { Icon } = config

  return (
    <div className={`flex items-start gap-4 p-6 rounded-xl border-2 ${config.cls}`}>
      <div className={`shrink-0 ${config.iconCls}`}>
        <Icon size={42} strokeWidth={1.4} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Claim Health Score</p>
        <h2 className={`font-serif text-2xl mt-1 ${config.iconCls}`}>{config.title}</h2>
        <p className="text-sm text-text-strong/85 mt-1.5 leading-relaxed">{config.desc}</p>
      </div>
    </div>
  )
}

function ProgressBar({ checked, total, anyLoading }) {
  if (anyLoading && total === 0) {
    return (
      <div className="bg-white border border-border-warm rounded-lg px-5 py-3.5">
        <span className="text-sm text-text-muted">Loading requirements…</span>
      </div>
    )
  }
  if (total === 0) {
    return (
      <div className="bg-white border border-border-warm rounded-lg px-5 py-3.5">
        <span className="text-sm text-text-muted">No required items for this combination.</span>
      </div>
    )
  }
  const pct = Math.round((checked / total) * 100)
  const barCls = pct === 100 ? 'bg-success' : pct > 0 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="bg-white border border-border-warm rounded-lg px-5 py-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-strong">
          <span className={pct === 100 ? 'text-success' : ''}>{checked}</span> of {total} required item{total === 1 ? '' : 's'} ready
        </span>
        <span className="text-xs text-text-muted tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-cream rounded-full overflow-hidden">
        <div className={`h-full ${barCls} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ChecklistList({ groups, checked, onToggle, readOnly, onSaveAi, onRetryAi }) {
  return (
    <div className="bg-white border border-border-warm rounded-lg overflow-hidden">
      {groups.map((g, gi) => {
        const isLastGroup = gi === groups.length - 1
        return (
          <div key={gi} className={isLastGroup ? '' : 'border-b border-border-warm'}>
            <GroupHeader group={g} onSaveAi={onSaveAi} onRetryAi={onRetryAi} />

            {g.source === 'ai-loading' && (
              <div className="px-5 py-6 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-teal" />
                <span className="text-sm text-text-muted">Asking Claude for payer-specific requirements for {g.cdt_code}…</span>
              </div>
            )}

            {g.source === 'ai-error' && (
              <div className="px-5 py-4 bg-danger/5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-strong">Couldn't load requirements for {g.cdt_code}.</p>
                    <p className="text-xs text-text-muted mt-1">{g.error}</p>
                  </div>
                  <button
                    onClick={() => onRetryAi?.(g.cdt_code)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border-warm rounded-full hover:bg-cream-light"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              </div>
            )}

            {(g.source === 'payer' || g.source === 'ai-suggested') && g.items.map((it, i) => {
              const required = it.priority === 'required' || it.denial_risk === 'high'
              const isChecked = checked.has(it.item)
              const isLastRow = i === g.items.length - 1
              return (
                <ChecklistRow
                  key={`${gi}-${i}`}
                  item={it}
                  required={required}
                  isChecked={isChecked}
                  isLast={isLastRow}
                  onToggle={() => !readOnly && onToggle?.(it.item)}
                  readOnly={readOnly}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function GroupHeader({ group, onSaveAi, onRetryAi }) {
  const { cdtCodes } = useData()
  const description = cdtCodes.find(c => c.code === group.cdt_code)?.description

  if (group.source === 'ai-suggested' && !group.frozen) {
    // AI-suggested banner — clearly distinct, with a Save Requirements action.
    return (
      <div className="px-5 py-3 bg-teal/5 border-b border-teal/30 flex items-center gap-2 flex-wrap">
        <CodeWithDescription code={group.cdt_code} description={description} />
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-teal font-semibold">
          <Sparkles size={11} /> AI-suggested
        </span>
        <span className="text-xs text-text-muted">Click <strong className="text-text-strong">Save Requirements</strong> to store for future use.</span>
        <button
          onClick={() => onSaveAi?.(group.cdt_code)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white text-xs font-medium rounded-full hover:opacity-90"
        >
          Save Requirements
        </button>
      </div>
    )
  }

  // Default header (payer / loading / error / frozen)
  return (
    <div className="px-5 py-2.5 bg-cream-light/60 border-b border-border-warm">
      <CodeWithDescription code={group.cdt_code} description={description} />
    </div>
  )
}

function CodeWithDescription({ code, description }) {
  return (
    <span className="inline-flex items-baseline gap-2 flex-wrap">
      <span className="font-mono text-xs font-semibold tracking-wider text-text-strong">{code}</span>
      {description && (
        <span className="text-xs text-text-muted">— {description}</span>
      )}
    </span>
  )
}

function ChecklistRow({ item, required, isChecked, isLast, onToggle, readOnly }) {
  const accent = isChecked
    ? 'border-l-4 border-l-success bg-success/5'
    : required
      ? 'border-l-4 border-l-danger bg-danger/5'
      : 'border-l-4 border-l-transparent'

  const Component = readOnly ? 'div' : 'button'
  const interactive = readOnly ? '' : 'hover:bg-cream-light cursor-pointer'

  return (
    <Component
      type={readOnly ? undefined : 'button'}
      onClick={readOnly ? undefined : onToggle}
      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${accent} ${interactive} ${isLast ? '' : 'border-b border-border-warm'}`}
    >
      <span
        className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          isChecked
            ? 'bg-success border-success'
            : required
              ? 'border-danger/60 bg-white'
              : 'border-text-muted/40 bg-white'
        }`}
        aria-hidden="true"
      >
        {isChecked && <Check size={16} className="text-white" strokeWidth={3} />}
      </span>

      <span className={`flex-1 text-[15px] leading-snug ${isChecked ? 'text-text-muted line-through' : 'text-text-strong'}`}>
        {item.item}
      </span>

      <span
        className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${
          required
            ? `bg-danger/15 text-danger ${isChecked ? 'opacity-50' : ''}`
            : `bg-warning/20 text-warning ${isChecked ? 'opacity-50' : ''}`
        }`}
      >
        {required ? 'Required' : 'Recommended'}
      </span>
    </Component>
  )
}
