// Shared helper for calling the Anthropic Messages API from server-side code.
// Reads ANTHROPIC_API_KEY from process.env (Vercel env var or local .env).
// Imported by both /api/*.js (Vercel serverless) and server/index.js (local dev).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

const NARRATIVE_MAX_TOKENS = 1000
const PARSE_MAX_TOKENS = 1500

const REQUIREMENTS_SCHEMA = {
  type: 'object',
  properties: {
    required_documents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          priority: { type: 'string', enum: ['required', 'recommended'] },
          denial_risk: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['item', 'priority', 'denial_risk'],
        additionalProperties: false,
      },
    },
    narrative_elements: { type: 'array', items: { type: 'string' } },
    watch_outs: { type: 'array', items: { type: 'string' } },
    frequency_limit: { type: 'string' },
    requires_pre_auth: { type: 'boolean' },
  },
  required: ['required_documents', 'narrative_elements', 'watch_outs', 'frequency_limit', 'requires_pre_auth'],
  additionalProperties: false,
}

const CLINICAL_NOTES_SCHEMA = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string', description: 'The periodontal diagnosis (e.g., "Generalized Stage III, Grade B periodontitis"). Empty string if not stated.' },
    probing_depths: {
      type: 'object',
      properties: {
        Q1: { type: 'string', description: 'Probing depth range Upper Right (e.g., "5-8mm"). Empty string if not stated.' },
        Q2: { type: 'string', description: 'Probing depth range Upper Left.' },
        Q3: { type: 'string', description: 'Probing depth range Lower Left.' },
        Q4: { type: 'string', description: 'Probing depth range Lower Right.' },
      },
      required: ['Q1', 'Q2', 'Q3', 'Q4'],
      additionalProperties: false,
    },
    bop_percentage: { type: 'string', description: 'Bleeding on probing as a percentage number (e.g., "82"). Empty string if not stated.' },
    bone_loss: { type: 'string', description: 'Bone loss description (e.g., "Moderate horizontal, 3-4mm"). Empty string if not stated.' },
    additional_notes: { type: 'string', description: 'Other relevant findings: calculus, furcation, recession, mobility. Empty string if none.' },
    last_prophy_date: { type: 'string', description: 'ISO YYYY-MM-DD if a date for last prophylaxis or perio maintenance is given. Empty string otherwise.' },
    prior_perio_treatment: { type: 'boolean', description: 'true if prior SRP or periodontal surgery is mentioned, false otherwise.' },
    prior_perio_date: { type: 'string', description: 'ISO YYYY-MM-DD of prior treatment if given. Empty string otherwise.' },
  },
  required: ['diagnosis', 'probing_depths', 'bop_percentage', 'bone_loss', 'additional_notes', 'last_prophy_date', 'prior_perio_treatment', 'prior_perio_date'],
  additionalProperties: false,
}

function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    const err = new Error('Server is missing ANTHROPIC_API_KEY environment variable.')
    err.statusCode = 500
    throw err
  }
  return key
}

async function callAnthropic(body) {
  const apiKey = getApiKey()
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `Claude API error (${res.status})`
    try {
      const errBody = await res.json()
      if (errBody?.error?.message) message = errBody.error.message
    } catch { /* swallow */ }
    const err = new Error(message)
    err.statusCode = res.status >= 400 && res.status < 500 ? 502 : 502
    throw err
  }
  return res.json()
}

export async function generateNarrative({ prompt }) {
  if (!prompt || typeof prompt !== 'string') {
    const err = new Error('Missing required field: prompt')
    err.statusCode = 400
    throw err
  }
  const data = await callAnthropic({
    model: MODEL,
    max_tokens: NARRATIVE_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = data?.content?.[0]?.text
  if (!text) {
    const err = new Error('Claude returned no content.')
    err.statusCode = 502
    throw err
  }
  return { text }
}

export async function parseClinicalNotes({ notesText }) {
  if (!notesText || typeof notesText !== 'string') {
    const err = new Error('Missing required field: notesText')
    err.statusCode = 400
    throw err
  }
  const prompt = `You are extracting structured clinical findings from periodontal practice notes. The user will paste free-form notes; extract every field you can identify and return them as JSON. Use empty string ("") for any field that is not stated. Do not invent or infer values that aren't supported by the text.

Quadrant convention: Q1 = Upper Right, Q2 = Upper Left, Q3 = Lower Left, Q4 = Lower Right.

Notes to parse:
"""
${notesText}
"""`

  const data = await callAnthropic({
    model: MODEL,
    max_tokens: PARSE_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      format: { type: 'json_schema', schema: CLINICAL_NOTES_SCHEMA },
    },
  })
  const text = data?.content?.[0]?.text
  if (!text) {
    const err = new Error('Claude returned no content.')
    err.statusCode = 502
    throw err
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const err = new Error('Claude response was not valid JSON.')
    err.statusCode = 502
    throw err
  }
  return { parsed }
}

export async function suggestRequirements({ payerName, code, description }) {
  if (!payerName || typeof payerName !== 'string' ||
      !code || typeof code !== 'string') {
    const err = new Error('Missing required fields: payerName, code')
    err.statusCode = 400
    throw err
  }
  const prompt = `You are a dental insurance billing expert. For the payer ${payerName} and CDT procedure code ${code} (${description || 'no description provided'}), what documentation is typically required for a claim submission from an out-of-network periodontist? Return a JSON object with this exact structure: { required_documents: [{ item: string, priority: 'required' or 'recommended', denial_risk: 'high' or 'medium' or 'low' }], narrative_elements: [string array of what should be included in the narrative], watch_outs: [string array of common denial risks and things to watch for], frequency_limit: string or null, requires_pre_auth: boolean }. Be specific to this payer. Do not make up requirements. If you are uncertain about a specific payer's rules, say what is generally expected for this procedure and note the uncertainty. Return only valid JSON, no markdown, no explanation.`

  const data = await callAnthropic({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      format: { type: 'json_schema', schema: REQUIREMENTS_SCHEMA },
    },
  })
  const text = data?.content?.[0]?.text
  if (!text) {
    const err = new Error('Claude returned no content.')
    err.statusCode = 502
    throw err
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const err = new Error('Claude response was not valid JSON.')
    err.statusCode = 502
    throw err
  }
  // Pass-through frequency_limit: caller spec allows null but the schema
  // forces a string; Claude returns "" or "Varies" in practice, both fine.
  return { suggestion: parsed }
}

// Adapter that both Vercel `(req, res)` and the local dev server can use.
export async function handle(operation, body, res) {
  try {
    let result
    if (operation === 'generate-narrative') {
      result = await generateNarrative(body || {})
    } else if (operation === 'parse-clinical-notes') {
      result = await parseClinicalNotes(body || {})
    } else if (operation === 'suggest-requirements') {
      result = await suggestRequirements(body || {})
    } else {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Unknown operation' }))
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (e) {
    const status = e.statusCode || 500
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e.message || 'Server error' }))
  }
}
