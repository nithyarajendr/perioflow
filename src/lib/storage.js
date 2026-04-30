// localStorage wrapper that mimics the spec's window.storage async API.
// Keep keys explicit (full "perioflow:..." form) so spec snippets work as-is.

export const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key)
      return value === null ? null : { value }
    } catch (e) {
      console.error('storage.get failed', key, e)
      return null
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.error('storage.set failed', key, e)
      throw e
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.error('storage.delete failed', key, e)
    }
  },

  async list(prefix = 'perioflow:') {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    return keys
  },

  async clearAll(prefix = 'perioflow:') {
    const keys = await storage.list(prefix)
    for (const k of keys) await storage.delete(k)
  },
}

export const KEYS = {
  payers: 'perioflow:payers',
  cdtCodes: 'perioflow:cdt-codes',
  requirements: 'perioflow:payer-requirements',
  claims: 'perioflow:claims',
  settings: 'perioflow:settings',
  feeSchedule: 'perioflow:fee-schedule',
}
