// Browser-side wrapper that calls our same-origin serverless API.
// Errors thrown from these functions are user-facing — no HTTP codes, no
// references to npm, .env, or "the AI server". Each function returns a
// short, action-oriented message the practice staff can act on.

async function callServer(path, body) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network-level failure (offline, DNS, etc.).
    const e = new Error('Network unavailable — check your connection and try again.')
    e._network = true
    throw e
  }

  if (!res.ok) {
    // Try to extract a server-supplied error string. We only forward it if it
    // looks user-facing; otherwise fall through to a generic friendly message
    // so we never leak HTTP codes or stack traces to users.
    let raw = null
    try {
      const body = await res.json()
      if (typeof body?.error === 'string') raw = body.error
    } catch { /* not JSON */ }

    const e = new Error('Generic upstream failure.')  // overridden by callers
    e._raw = raw
    e._status = res.status
    throw e
  }
  return res.json()
}

// Each public helper translates internal failure into a single
// user-facing sentence pair: what's wrong + what to do next.

export async function generateNarrative({ prompt }) {
  try {
    const data = await callServer('/api/generate-narrative', { prompt })
    if (!data?.text) throw new Error('empty')
    return data.text
  } catch {
    throw new Error("Couldn't generate the narrative right now. Try again, or write one manually below.")
  }
}

export async function parseClinicalNotes({ notesText }) {
  try {
    const data = await callServer('/api/parse-clinical-notes', { notesText })
    if (!data?.parsed) throw new Error('empty')
    return data.parsed
  } catch {
    throw new Error("Couldn't read those notes right now. Try again, or fill in the fields manually.")
  }
}

export async function suggestRequirements({ payerName, code, description }) {
  try {
    const data = await callServer('/api/suggest-requirements', { payerName, code, description })
    if (!data?.suggestion) throw new Error('empty')
    return data.suggestion
  } catch {
    throw new Error("Couldn't load requirements right now. Click Retry to try again, or add requirements manually in Settings.")
  }
}
