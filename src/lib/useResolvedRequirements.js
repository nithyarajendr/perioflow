import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from './DataContext'
import { suggestRequirements } from './api'

/**
 * Resolves a claim's per-procedure documentation requirements with three sources:
 *
 *   • 'payer'        — practice/saved entry from `perioflow:payer-requirements`
 *   • 'ai-suggested' — Claude generated this on the fly (not yet saved)
 *   • 'ai-loading'   — fetching from Claude
 *   • 'ai-error'     — fetch failed (with retry support)
 *
 * Per-procedure caching is keyed by `${payer_id}__${cdt_code}` and lives in
 * component state, so navigating away and back re-fetches (cheap; we want
 * fresh suggestions if rules drift). Once the user clicks "Save Requirements",
 * the result lands in the requirements table and subsequent visits load
 * instantly via the 'payer' branch.
 *
 * Returns:
 *   { groups, saveAi, retryAi }
 */
export function useResolvedRequirements(claim) {
  const { requirements, cdtCodes, getPayer, saveRequirement } = useData()

  // Per-key state: { status, data?, error? }
  const [aiState, setAiState] = useState({})

  const groups = useMemo(() => {
    const out = []
    for (const proc of claim?.procedures || []) {
      if (!proc.cdt_code) continue
      const key = `${claim.payer_id}__${proc.cdt_code}`
      const stored = requirements.find(r => r.payer_id === claim.payer_id && r.cdt_code === proc.cdt_code)

      if (stored) {
        out.push({
          source: 'payer',
          cdt_code: proc.cdt_code,
          items: stored.required_documents || [],
          watch_outs: stored.watch_outs || [],
          narrative_elements: stored.narrative_elements || [],
        })
        continue
      }

      const ai = aiState[key]
      if (ai?.status === 'success' && ai.data) {
        out.push({
          source: 'ai-suggested',
          cdt_code: proc.cdt_code,
          items: ai.data.required_documents || [],
          watch_outs: ai.data.watch_outs || [],
          narrative_elements: ai.data.narrative_elements || [],
          aiData: ai.data,
        })
      } else if (ai?.status === 'error') {
        out.push({
          source: 'ai-error',
          cdt_code: proc.cdt_code,
          items: [],
          watch_outs: [],
          narrative_elements: [],
          error: ai.error,
        })
      } else {
        out.push({
          source: 'ai-loading',
          cdt_code: proc.cdt_code,
          items: [],
          watch_outs: [],
          narrative_elements: [],
        })
      }
    }
    return out
  }, [claim, requirements, aiState])

  // Effect: kick off AI fetch for any procedure missing a stored requirement.
  useEffect(() => {
    const procs = claim?.procedures || []
    const payerId = claim?.payer_id
    if (!payerId) return

    for (const proc of procs) {
      if (!proc.cdt_code) continue
      const stored = requirements.find(r => r.payer_id === payerId && r.cdt_code === proc.cdt_code)
      if (stored) continue
      const key = `${payerId}__${proc.cdt_code}`
      if (aiState[key]) continue // already loading / done / errored — leave alone

      // Mark as loading and fetch.
      setAiState(s => ({ ...s, [key]: { status: 'loading' } }))
      const cdt = cdtCodes.find(c => c.code === proc.cdt_code)
      const payer = getPayer(payerId)
      ;(async () => {
        try {
          const data = await suggestRequirements({
            payerName: payer?.name || payerId,
            code: proc.cdt_code,
            description: cdt?.description || '',
          })
          setAiState(s => ({ ...s, [key]: { status: 'success', data } }))
        } catch (err) {
          setAiState(s => ({ ...s, [key]: { status: 'error', error: err.message || 'AI request failed' } }))
        }
      })()
    }
  }, [claim, requirements, cdtCodes, aiState, getPayer])

  const retryAi = useCallback((cdt_code) => {
    if (!claim?.payer_id || !cdt_code) return
    const key = `${claim.payer_id}__${cdt_code}`
    setAiState(s => {
      const next = { ...s }
      delete next[key]
      return next
    })
  }, [claim])

  const saveAi = useCallback(async (cdt_code) => {
    if (!claim?.payer_id || !cdt_code) return
    const key = `${claim.payer_id}__${cdt_code}`
    const ai = aiState[key]
    if (!ai || ai.status !== 'success') return
    const newReq = {
      id: key,
      payer_id: claim.payer_id,
      cdt_code,
      required_documents: ai.data.required_documents || [],
      narrative_elements: ai.data.narrative_elements || [],
      watch_outs: ai.data.watch_outs || [],
      frequency_limit: ai.data.frequency_limit || '',
      requires_pre_auth: !!ai.data.requires_pre_auth,
      _origin: 'ai',
    }
    await saveRequirement(newReq)
    // Once saved, the requirements list updates and the group's source becomes 'payer'.
  }, [claim, aiState, saveRequirement])

  return { groups, saveAi, retryAi }
}
