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
export default function RequirementsChecklist({ groups, checked, onToggle, breakdown, readOnly = false, onSaveAi, onRetryAi }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="bg-white border border-border-warm rounded-lg p-6 text-center text-text-muted">
        Add a procedure to see the documentation requirements.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <RequirementsHealthSection groups={groups} checked={checked} breakdown={breakdown} />
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

export function RequirementsHealthSection({ groups, checked, breakdown }) {
  if (!groups || groups.length === 0) return null
  const stats = computeChecklistStats(groups, checked)
  return (
    <HealthScoreCard
      breakdown={breakdown}
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
      <ProgressBar
        checked={stats.requiredChecked}
        total={stats.requiredItems.length}
        anyLoading={stats.anyLoading}
        anyError={stats.anyError}
      />
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

function HealthScoreCard({ breakdown, anyLoading, anyError }) {
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
            Requirements will load automatically when connected. You can still save this claim as a draft and the requirements will load when you view it later.
          </p>
        </div>
      </div>
    )
  }

  if (!breakdown || !breakdown.status) return null

  const {
    status,
    requiredCount, requiredChecked,
    recommendedCount, recommendedChecked,
    narrativeApproved, narrativePresent,
  } = breakdown

  const headerConfig = {
    green: { cls: 'bg-success/10 border-success/50', iconCls: 'text-success', Icon: CheckCircle2, title: 'Ready to submit' },
    yellow: { cls: 'bg-warning/10 border-warning/50', iconCls: 'text-warning', Icon: AlertTriangle, title: 'Almost there' },
    red: { cls: 'bg-danger/10 border-danger/50', iconCls: 'text-danger', Icon: AlertOctagon, title: 'Action required' },
  }[status]

  // Documentation status line — broken out from the narrative line so it's
  // obvious which is done and which is blocking.
  const allRequiredChecked = requiredCount === 0 || requiredChecked === requiredCount
  const recommendedRemaining = Math.max(0, recommendedCount - recommendedChecked)
  let docText
  if (allRequiredChecked && recommendedRemaining === 0) {
    docText = `Documentation: ${requiredChecked} of ${requiredCount} required items checked${recommendedCount > 0 ? ' · all recommended items checked' : ''}`
  } else if (allRequiredChecked) {
    docText = `Documentation: ${requiredChecked} of ${requiredCount} required items checked · ${recommendedRemaining} recommended unchecked`
  } else {
    const missing = requiredCount - requiredChecked
    docText = `Documentation: ${requiredChecked} of ${requiredCount} required items checked — ${missing} more needed`
  }
  const DocIcon = allRequiredChecked ? CheckCircle2 : AlertOctagon
  const docIconCls = allRequiredChecked ? 'text-success' : 'text-danger'

  // Narrative status — independent indicator. When unapproved, the text is
  // a smooth-scroll link to the Narrative section so the user can jump
  // straight to fixing it.
  let narrativeText, NarrativeIcon, narrativeIconCls, narrativeIsLink
  if (narrativeApproved) {
    narrativeText = 'Narrative: Approved'
    NarrativeIcon = CheckCircle2
    narrativeIconCls = 'text-success'
    narrativeIsLink = false
  } else if (narrativePresent) {
    narrativeText = 'Narrative: Not yet approved'
    NarrativeIcon = AlertTriangle
    narrativeIconCls = 'text-warning'
    narrativeIsLink = true
  } else {
    narrativeText = 'Narrative: Not yet written'
    NarrativeIcon = AlertTriangle
    narrativeIconCls = 'text-warning'
    narrativeIsLink = true
  }
  const onScrollToNarrative = (e) => {
    e.preventDefault()
    const el = document.getElementById('narrative')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const { Icon } = headerConfig
  return (
    <div className={`flex items-start gap-4 p-6 rounded-xl border-2 ${headerConfig.cls}`}>
      <div className={`shrink-0 ${headerConfig.iconCls}`}>
        <Icon size={42} strokeWidth={1.4} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Claim Health Score</p>
        <h2 className={`font-serif text-2xl mt-1 ${headerConfig.iconCls}`}>{headerConfig.title}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <DocIcon size={16} className={`shrink-0 mt-0.5 ${docIconCls}`} />
            <span className="text-text-strong">{docText}</span>
          </li>
          <li className="flex items-start gap-2">
            <NarrativeIcon size={16} className={`shrink-0 mt-0.5 ${narrativeIconCls}`} />
            {narrativeIsLink ? (
              <a
                href="#narrative"
                onClick={onScrollToNarrative}
                className="text-teal underline underline-offset-2 hover:text-teal/80 cursor-pointer"
              >
                {narrativeText}
              </a>
            ) : (
              <span className="text-text-strong">{narrativeText}</span>
            )}
          </li>
        </ul>
      </div>
    </div>
  )
}

function ProgressBar({ checked, total, anyLoading, anyError }) {
  if (anyLoading && total === 0) {
    return (
      <div className="bg-white border border-border-warm rounded-lg px-5 py-3.5">
        <span className="text-sm text-text-muted">Loading requirements…</span>
      </div>
    )
  }
  // Error takes precedence over the empty state — when groups failed to load
  // we don't actually know whether there are required items, so the
  // "No required items" copy would be misleading.
  if (anyError && total === 0) {
    return (
      <div className="bg-warning/5 border border-warning/40 rounded-lg px-5 py-3.5">
        <span className="text-sm text-text-strong">Requirements couldn't be loaded — see details below to retry.</span>
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
