import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Trash2, Pencil, Download, Upload, RotateCcw, Save, DollarSign } from 'lucide-react'
import { useData } from '../lib/DataContext'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Settings() {
  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl font-semibold text-text-strong">Settings</h1>
        <p className="text-text-muted mt-1">Practice info, fee schedule, payers, requirements, and data management.</p>
      </header>
      <PracticeInfoSection />
      <FeeScheduleSection />
      <PayersSection />
      <RequirementsSection />
      <DataManagementSection />
    </div>
  )
}

// ---------- Section: Practice info ----------

function Section({ title, description, children }) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-strong">{title}</h2>
        {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-text-strong mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal'

function PracticeInfoSection() {
  const { settings, saveSettings } = useData()
  const { show } = useToast()
  const [form, setForm] = useState(settings)

  useEffect(() => { setForm(settings) }, [settings])

  const onSave = async (e) => {
    e.preventDefault()
    try {
      await saveSettings(form)
      show('Practice information saved', 'success')
    } catch {
      show('Failed to save settings', 'error')
    }
  }

  return (
    <Section title="Practice Information" description="Used in claim packets and the printable PDF header.">
      <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Practice Name">
          <input className={inputCls} value={form.practice_name || ''} onChange={e => setForm({ ...form, practice_name: e.target.value })} />
        </Field>
        <Field label="Provider Name">
          <input className={inputCls} value={form.provider_name || ''} onChange={e => setForm({ ...form, provider_name: e.target.value })} />
        </Field>
        <Field label="Practice Address" className="md:col-span-2">
          <input className={inputCls} value={form.practice_address || ''} onChange={e => setForm({ ...form, practice_address: e.target.value })} />
        </Field>
        <Field label="Practice Phone">
          <input className={inputCls} value={form.practice_phone || ''} onChange={e => setForm({ ...form, practice_phone: e.target.value })} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-md text-sm font-medium hover:opacity-90">
            <Save size={16} /> Save
          </button>
        </div>
      </form>
    </Section>
  )
}

// ---------- Section: Fee Schedule ----------

function FeeScheduleSection() {
  const { cdtCodes, feeSchedule, saveFeeSchedule } = useData()
  const { show } = useToast()
  const [draft, setDraft] = useState({})
  const [filter, setFilter] = useState('')

  useEffect(() => {
    // Hydrate draft from saved fee schedule (numbers → string for input value)
    const next = {}
    for (const code of Object.keys(feeSchedule)) {
      next[code] = feeSchedule[code] == null ? '' : String(feeSchedule[code])
    }
    setDraft(next)
  }, [feeSchedule])

  const visible = useMemo(() => {
    if (!filter.trim()) return cdtCodes
    const q = filter.toLowerCase()
    return cdtCodes.filter(c =>
      c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    )
  }, [cdtCodes, filter])

  const dirty = useMemo(() => {
    // Compare the current draft (as numbers) against the saved schedule.
    const keys = new Set([...Object.keys(draft), ...Object.keys(feeSchedule)])
    for (const k of keys) {
      const d = draft[k]
      const dNum = d === '' || d == null ? null : Number(d)
      const sNum = feeSchedule[k] == null || feeSchedule[k] === '' ? null : Number(feeSchedule[k])
      if (dNum !== sNum) return true
    }
    return false
  }, [draft, feeSchedule])

  const onSave = async () => {
    const cleaned = {}
    for (const [code, val] of Object.entries(draft)) {
      if (val === '' || val == null) continue
      const n = Number(val)
      if (Number.isFinite(n) && n >= 0) cleaned[code] = n
    }
    try {
      await saveFeeSchedule(cleaned)
      show('Fee schedule saved', 'success')
    } catch {
      show('Failed to save fee schedule', 'error')
    }
  }

  const overrideCount = Object.values(feeSchedule).filter(v => v != null && v !== '').length

  return (
    <Section
      title="Fee Schedule"
      description="Each CDT code has a starting default fee. Set your practice fee to override it — auto-fills when adding procedures to a new claim. Leave blank to use the default."
    >
      <div className="flex items-center gap-2 mb-3">
        <DollarSign size={16} className="text-text-muted shrink-0" />
        <input
          className={inputCls}
          placeholder="Filter by code or description (e.g., D4341 or scaling)…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      <div className="border border-gray-200 rounded-md max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-text-muted sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-24">Code</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right w-24">Default</th>
              <th className="px-3 py-2 text-right w-40">Your Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(c => {
              const defaultFee = c.default_fee
              const draftVal = draft[c.code] ?? ''
              const draftNum = draftVal === '' ? null : Number(draftVal)
              const isOverridden = draftNum != null && Number.isFinite(draftNum) && draftNum !== defaultFee
              return (
                <tr key={c.code} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-text-strong">{c.code}</td>
                  <td className="px-3 py-2 text-text-muted truncate max-w-md">{c.description}</td>
                  <td className="px-3 py-2 text-right text-text-muted whitespace-nowrap">
                    {defaultFee != null ? `$${defaultFee}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={defaultFee != null ? String(defaultFee) : '—'}
                        value={draftVal}
                        onChange={e => setDraft({ ...draft, [c.code]: e.target.value })}
                        className={`w-full pl-5 pr-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal/40 ${isOverridden ? 'border-teal text-teal font-medium' : 'border-gray-300'}`}
                      />
                    </div>
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, [c.code]: '' })}
                        className="block ml-auto mt-0.5 text-[11px] text-text-muted hover:text-navy"
                      >
                        Reset to default
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted">No codes match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-text-muted">
          {overrideCount === 0
            ? 'Using default fees for all codes.'
            : `${overrideCount} code${overrideCount === 1 ? '' : 's'} overridden — the rest use defaults.`}
        </p>
        <button
          onClick={onSave}
          disabled={!dirty}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          <Save size={16} /> {dirty ? 'Save Fee Schedule' : 'No changes'}
        </button>
      </div>
    </Section>
  )
}

// ---------- Section: Payers ----------

function PayersSection() {
  const { payers, savePayer } = useData()
  const { show } = useToast()
  const [editing, setEditing] = useState(null) // null = closed, {} = new, payer = edit
  const sorted = useMemo(() => [...payers].sort((a, b) => a.name.localeCompare(b.name)), [payers])

  const blank = { payer_id: '', name: '', plan_type: 'PPO', notes: '', portal_url: '' }

  const onSubmit = async (form) => {
    try {
      const payer_id = form.payer_id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      if (!payer_id || !form.name) {
        show('Name is required', 'error')
        return
      }
      await savePayer({ ...form, payer_id })
      show('Payer saved', 'success')
      setEditing(null)
    } catch {
      show('Failed to save payer', 'error')
    }
  }

  return (
    <Section title="Payer Management" description="Insurance companies your practice submits claims to.">
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing(blank)} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-teal text-white rounded-md hover:opacity-90">
          <Plus size={16} /> Add Payer
        </button>
      </div>
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Plan Type</th>
              <th className="px-4 py-2">Notes</th>
              <th className="px-4 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(p => (
              <tr key={p.payer_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-text-strong">{p.name}</td>
                <td className="px-4 py-2 text-text-muted">{p.plan_type}</td>
                <td className="px-4 py-2 text-text-muted truncate max-w-md">{p.notes}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(p)} className="text-text-muted hover:text-navy" aria-label={`Edit ${p.name}`}>
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">No payers configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <PayerEditModal payer={editing} onCancel={() => setEditing(null)} onSubmit={onSubmit} />
      )}
    </Section>
  )
}

function PayerEditModal({ payer, onCancel, onSubmit }) {
  const [form, setForm] = useState(payer)
  const isNew = !payer.payer_id
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-text-strong mb-4">{isNew ? 'Add Payer' : 'Edit Payer'}</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Name">
            <input className={inputCls} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Plan Type">
            <input className={inputCls} value={form.plan_type || ''} onChange={e => setForm({ ...form, plan_type: e.target.value })} />
          </Field>
          <Field label="Portal URL">
            <input className={inputCls} value={form.portal_url || ''} onChange={e => setForm({ ...form, portal_url: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-text-muted hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 text-sm bg-navy text-white rounded-md hover:opacity-90">Save</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Section: Payer Requirements ----------

function RequirementsSection() {
  const { payers, cdtCodes, requirements, saveRequirement } = useData()
  const { show } = useToast()
  const [payerId, setPayerId] = useState('')
  const [code, setCode] = useState('')
  const [draft, setDraft] = useState(null)

  const existing = useMemo(() => requirements.find(r => r.payer_id === payerId && r.cdt_code === code), [requirements, payerId, code])

  useEffect(() => {
    if (!payerId || !code) {
      setDraft(null)
      return
    }
    setDraft(existing || {
      id: `${payerId}__${code}`,
      payer_id: payerId,
      cdt_code: code,
      required_documents: [],
      narrative_elements: [],
      watch_outs: [],
      frequency_limit: '',
      requires_pre_auth: false,
    })
  }, [payerId, code, existing])

  const updateDoc = (idx, patch) => {
    const docs = [...draft.required_documents]
    docs[idx] = { ...docs[idx], ...patch }
    setDraft({ ...draft, required_documents: docs })
  }
  const removeDoc = (idx) => setDraft({ ...draft, required_documents: draft.required_documents.filter((_, i) => i !== idx) })
  const addDoc = () => setDraft({ ...draft, required_documents: [...draft.required_documents, { item: '', priority: 'required', denial_risk: 'medium' }] })

  const updateList = (key, idx, value) => {
    const arr = [...draft[key]]
    arr[idx] = value
    setDraft({ ...draft, [key]: arr })
  }
  const removeListItem = (key, idx) => setDraft({ ...draft, [key]: draft[key].filter((_, i) => i !== idx) })
  const addListItem = (key) => setDraft({ ...draft, [key]: [...draft[key], ''] })

  const onSave = async () => {
    try {
      const cleaned = {
        ...draft,
        required_documents: draft.required_documents.filter(d => d.item?.trim()),
        narrative_elements: draft.narrative_elements.filter(s => s?.trim()),
        watch_outs: draft.watch_outs.filter(s => s?.trim()),
      }
      await saveRequirement(cleaned)
      show('Requirements saved', 'success')
    } catch {
      show('Failed to save requirements', 'error')
    }
  }

  return (
    <Section title="Payer Requirements" description="Per-payer per-procedure documentation expectations and risk flags. Used by the New Claim wizard.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Payer">
          <select className={inputCls} value={payerId} onChange={e => setPayerId(e.target.value)}>
            <option value="">Select a payer…</option>
            {payers.map(p => <option key={p.payer_id} value={p.payer_id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="CDT Code">
          <select className={inputCls} value={code} onChange={e => setCode(e.target.value)}>
            <option value="">Select a code…</option>
            {cdtCodes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.description}</option>)}
          </select>
        </Field>
      </div>

      {draft && (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-text-strong">Required Documents</h4>
              <button onClick={addDoc} className="text-sm text-teal inline-flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
            <div className="space-y-2">
              {draft.required_documents.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input className={inputCls} value={d.item} onChange={e => updateDoc(i, { item: e.target.value })} placeholder="e.g., Full periodontal charting" />
                  <select className="px-2 py-2 border border-gray-300 rounded-md text-sm" value={d.priority} onChange={e => updateDoc(i, { priority: e.target.value })}>
                    <option value="required">Required</option>
                    <option value="recommended">Recommended</option>
                  </select>
                  <select className="px-2 py-2 border border-gray-300 rounded-md text-sm" value={d.denial_risk} onChange={e => updateDoc(i, { denial_risk: e.target.value })}>
                    <option value="high">High risk</option>
                    <option value="medium">Medium risk</option>
                    <option value="low">Low risk</option>
                  </select>
                  <button onClick={() => removeDoc(i)} className="p-2 text-text-muted hover:text-danger" aria-label="Remove"><Trash2 size={16} /></button>
                </div>
              ))}
              {draft.required_documents.length === 0 && <p className="text-sm text-text-muted">No documents listed.</p>}
            </div>
          </div>

          <ListEditor title="Narrative Elements" items={draft.narrative_elements}
            onUpdate={(i, v) => updateList('narrative_elements', i, v)}
            onRemove={(i) => removeListItem('narrative_elements', i)}
            onAdd={() => addListItem('narrative_elements')} />

          <ListEditor title="Watch-outs" items={draft.watch_outs}
            onUpdate={(i, v) => updateList('watch_outs', i, v)}
            onRemove={(i) => removeListItem('watch_outs', i)}
            onAdd={() => addListItem('watch_outs')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Frequency Limit">
              <input className={inputCls} value={draft.frequency_limit || ''} onChange={e => setDraft({ ...draft, frequency_limit: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 mt-6">
              <input type="checkbox" className="h-4 w-4" checked={!!draft.requires_pre_auth} onChange={e => setDraft({ ...draft, requires_pre_auth: e.target.checked })} />
              <span className="text-sm text-text-strong">Requires pre-authorization</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-md text-sm font-medium hover:opacity-90">
              <Save size={16} /> Save Requirements
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

function ListEditor({ title, items, onUpdate, onRemove, onAdd }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-text-strong">{title}</h4>
        <button onClick={onAdd} className="text-sm text-teal inline-flex items-center gap-1"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} value={s} onChange={e => onUpdate(i, e.target.value)} />
            <button onClick={() => onRemove(i)} className="p-2 text-text-muted hover:text-danger" aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-text-muted">None added.</p>}
      </div>
    </div>
  )
}

// ---------- Section: Data management ----------

function DataManagementSection() {
  const { exportAll, importAll, resetToDefaults } = useData()
  const { show } = useToast()
  const fileRef = useRef(null)
  const [confirm, setConfirm] = useState(null) // 'reset' | 'import'
  const [pendingImport, setPendingImport] = useState(null)

  const onExport = async () => {
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `perioflow-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      show('Data exported', 'success')
    } catch {
      show('Export failed', 'error')
    }
  }

  const onPickImport = () => fileRef.current?.click()

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset input so the same file can be chosen again
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setPendingImport(data)
      setConfirm('import')
    } catch {
      show('Invalid JSON file', 'error')
    }
  }

  const doImport = async () => {
    setConfirm(null)
    try {
      await importAll(pendingImport)
      setPendingImport(null)
      show('Data imported', 'success')
    } catch (err) {
      show(err.message || 'Import failed', 'error')
    }
  }

  const doReset = async () => {
    setConfirm(null)
    try {
      await resetToDefaults()
      show('All data reset to defaults', 'success')
    } catch {
      show('Reset failed', 'error')
    }
  }

  return (
    <Section title="Data Management" description="Export, import, or reset all PerioFlow data.">
      <div className="flex flex-wrap gap-3">
        <button onClick={onExport} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
          <Download size={16} /> Export All Data
        </button>
        <button onClick={onPickImport} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
          <Upload size={16} /> Import Data
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFileChosen} />
        <button onClick={() => setConfirm('reset')} className="inline-flex items-center gap-2 px-4 py-2 border border-danger/40 text-danger rounded-md text-sm hover:bg-danger/5">
          <RotateCcw size={16} /> Reset to Defaults
        </button>
      </div>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset all data?"
        message="All claims, payer edits, and requirement edits will be deleted. Seed data will be restored. This cannot be undone."
        confirmLabel="Reset Everything"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={doReset}
      />
      <ConfirmDialog
        open={confirm === 'import'}
        title="Replace all current data?"
        message="The imported file will overwrite your current claims, payers, requirements, and settings."
        confirmLabel="Import & Replace"
        danger
        onCancel={() => { setConfirm(null); setPendingImport(null) }}
        onConfirm={doImport}
      />
    </Section>
  )
}
