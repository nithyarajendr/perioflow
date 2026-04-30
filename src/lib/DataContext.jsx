import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { storage, KEYS } from './storage'
import { SEED_PAYERS, SEED_CDT_CODES, SEED_REQUIREMENTS, SEED_SETTINGS } from './seedData'

const DataContext = createContext(null)

async function loadJson(key, fallback) {
  const r = await storage.get(key)
  if (!r) return fallback
  try {
    return JSON.parse(r.value)
  } catch {
    return fallback
  }
}

async function saveJson(key, value) {
  await storage.set(key, JSON.stringify(value))
}

async function seedIfEmpty() {
  const existing = await storage.get(KEYS.payers)
  if (existing) return false
  await saveJson(KEYS.payers, SEED_PAYERS)
  await saveJson(KEYS.cdtCodes, SEED_CDT_CODES)
  await saveJson(KEYS.requirements, SEED_REQUIREMENTS)
  await saveJson(KEYS.settings, SEED_SETTINGS)
  await saveJson(KEYS.claims, [])
  return true
}

export function DataProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  const [payers, setPayers] = useState([])
  const [cdtCodes, setCdtCodes] = useState([])
  const [requirements, setRequirements] = useState([])
  const [claims, setClaims] = useState([])
  const [settings, setSettings] = useState(SEED_SETTINGS)
  const [feeSchedule, setFeeSchedule] = useState({})

  const reload = useCallback(async () => {
    const [p, c, r, cl, s, f] = await Promise.all([
      loadJson(KEYS.payers, []),
      loadJson(KEYS.cdtCodes, []),
      loadJson(KEYS.requirements, []),
      loadJson(KEYS.claims, []),
      loadJson(KEYS.settings, SEED_SETTINGS),
      loadJson(KEYS.feeSchedule, {}),
    ])
    setPayers(p)
    setCdtCodes(c)
    setRequirements(r)
    setClaims(cl)
    setSettings(s)
    setFeeSchedule(f)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        await seedIfEmpty()
        if (!cancelled) {
          await reload()
          setLoaded(true)
        }
      } catch (e) {
        console.error('Bootstrap failed', e)
        setLoaded(true)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [reload])

  // ---- Claims CRUD ----
  const generateClaimId = useCallback(() => {
    const year = new Date().getFullYear()
    const yearClaims = claims.filter(c => c.claim_id?.startsWith(`CLM-${year}-`))
    const maxN = yearClaims.reduce((m, c) => {
      const n = parseInt(c.claim_id.split('-')[2], 10)
      return Number.isFinite(n) && n > m ? n : m
    }, 0)
    return `CLM-${year}-${String(maxN + 1).padStart(4, '0')}`
  }, [claims])

  const saveClaim = useCallback(async (claim) => {
    const next = [...claims]
    const idx = next.findIndex(c => c.claim_id === claim.claim_id)
    if (idx >= 0) next[idx] = claim
    else next.push(claim)
    setClaims(next)
    await saveJson(KEYS.claims, next)
  }, [claims])

  const deleteClaim = useCallback(async (claim_id) => {
    const next = claims.filter(c => c.claim_id !== claim_id)
    setClaims(next)
    await saveJson(KEYS.claims, next)
  }, [claims])

  // ---- Payers CRUD ----
  const savePayer = useCallback(async (payer) => {
    const next = [...payers]
    const idx = next.findIndex(p => p.payer_id === payer.payer_id)
    if (idx >= 0) next[idx] = payer
    else next.push(payer)
    setPayers(next)
    await saveJson(KEYS.payers, next)
  }, [payers])

  // ---- Requirements CRUD ----
  const saveRequirement = useCallback(async (req) => {
    const next = [...requirements]
    const idx = next.findIndex(r => r.id === req.id)
    if (idx >= 0) next[idx] = req
    else next.push(req)
    setRequirements(next)
    await saveJson(KEYS.requirements, next)
  }, [requirements])

  // ---- Settings ----
  const saveSettings = useCallback(async (newSettings) => {
    setSettings(newSettings)
    await saveJson(KEYS.settings, newSettings)
  }, [])

  // ---- Fee schedule ----
  const saveFeeSchedule = useCallback(async (next) => {
    setFeeSchedule(next)
    await saveJson(KEYS.feeSchedule, next)
  }, [])

  const getFeeForCode = useCallback((code) => {
    const v = feeSchedule[code]
    return v == null || v === '' ? null : Number(v)
  }, [feeSchedule])

  // ---- Data management ----
  const exportAll = useCallback(async () => {
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      payers,
      cdt_codes: cdtCodes,
      payer_requirements: requirements,
      claims,
      settings,
      fee_schedule: feeSchedule,
    }
  }, [payers, cdtCodes, requirements, claims, settings, feeSchedule])

  const importAll = useCallback(async (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid data file')
    if (Array.isArray(data.payers)) await saveJson(KEYS.payers, data.payers)
    if (Array.isArray(data.cdt_codes)) await saveJson(KEYS.cdtCodes, data.cdt_codes)
    if (Array.isArray(data.payer_requirements)) await saveJson(KEYS.requirements, data.payer_requirements)
    if (Array.isArray(data.claims)) await saveJson(KEYS.claims, data.claims)
    if (data.settings && typeof data.settings === 'object') await saveJson(KEYS.settings, data.settings)
    if (data.fee_schedule && typeof data.fee_schedule === 'object') await saveJson(KEYS.feeSchedule, data.fee_schedule)
    await reload()
  }, [reload])

  const resetToDefaults = useCallback(async () => {
    await storage.clearAll('perioflow:')
    await seedIfEmpty()
    await reload()
  }, [reload])

  // ---- Lookups ----
  const getPayer = useCallback((payer_id) => payers.find(p => p.payer_id === payer_id), [payers])
  const getCdt = useCallback((code) => cdtCodes.find(c => c.code === code), [cdtCodes])
  const getRequirement = useCallback((payer_id, cdt_code) =>
    requirements.find(r => r.payer_id === payer_id && r.cdt_code === cdt_code),
  [requirements])

  const value = {
    loaded,
    payers, cdtCodes, requirements, claims, settings, feeSchedule,
    saveClaim, deleteClaim, generateClaimId,
    savePayer,
    saveRequirement,
    saveSettings,
    saveFeeSchedule, getFeeForCode,
    exportAll, importAll, resetToDefaults,
    getPayer, getCdt, getRequirement,
    reload,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
