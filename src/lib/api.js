// Direct browser call to Anthropic's Claude API.
// Model: claude-sonnet-4-6 (Sonnet 4.6).

const MODEL = 'claude-sonnet-4-6'
const COMMON_HEADERS = (apiKey) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

async function callClaude({ apiKey, body }) {
  if (!apiKey) {
    throw new Error('No API key configured. Add one in Settings → AI Configuration.')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: COMMON_HEADERS(apiKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `Claude API error (${res.status})`
    try {
      const errBody = await res.json()
      if (errBody?.error?.message) message = errBody.error.message
    } catch { /* swallow */ }
    throw new Error(message)
  }
  return res.json()
}

export async function generateNarrative({ apiKey, prompt }) {
  const data = await callClaude({
    apiKey,
    body: {
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    },
  })
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Claude returned no content.')
  return text
}

// JSON schema for structured-output extraction. Empty strings = "not stated".
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

export async function parseClinicalNotes({ apiKey, notesText }) {
  const prompt = `You are extracting structured clinical findings from periodontal practice notes. The user will paste free-form notes; extract every field you can identify and return them as JSON. Use empty string ("") for any field that is not stated. Do not invent or infer values that aren't supported by the text.

Quadrant convention: Q1 = Upper Right, Q2 = Upper Left, Q3 = Lower Left, Q4 = Lower Right.

Notes to parse:
"""
${notesText}
"""`

  const data = await callClaude({
    apiKey,
    body: {
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: { type: 'json_schema', schema: CLINICAL_NOTES_SCHEMA },
      },
    },
  })
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Claude returned no content.')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Claude response was not valid JSON.')
  }
}
