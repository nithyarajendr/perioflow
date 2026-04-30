// Browser-side wrapper that calls our same-origin serverless API.
// The Anthropic API key lives only in process.env on the server (Vercel env
// var or local .env.local) — it is never sent to or stored by the browser.

async function callServer(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `AI request failed (${res.status})`
    try {
      const errBody = await res.json()
      if (errBody?.error) message = errBody.error
    } catch { /* swallow */ }
    throw new Error(message)
  }
  return res.json()
}

export async function generateNarrative({ prompt }) {
  const data = await callServer('/api/generate-narrative', { prompt })
  const text = data?.text
  if (!text) throw new Error('Server returned no narrative content.')
  return text
}

export async function parseClinicalNotes({ notesText }) {
  const data = await callServer('/api/parse-clinical-notes', { notesText })
  if (!data?.parsed) throw new Error('Server returned no parsed result.')
  return data.parsed
}
