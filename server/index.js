/* eslint-env node */
// Local dev server that mirrors the Vercel serverless functions on port 8787.
// Vite's `server.proxy['/api']` (vite.config.js) forwards browser requests
// here so the same code path works locally and on Vercel.
//
// Usage:
//   npm run dev:api               # uses .env.local for ANTHROPIC_API_KEY
//   ANTHROPIC_API_KEY=sk-... node server/index.js   # or set inline

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handle } from '../api/_anthropic.js'

// ---- Tiny .env loader (no dotenv dep) ----
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
for (const file of ['.env.local', '.env']) {
  const p = join(projectRoot, file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Treat an inherited empty string as "not set" — parent shells sometimes
    // export ANTHROPIC_API_KEY="" which would otherwise block the .env.local value.
    if (!process.env[key]) process.env[key] = value
  }
}

const PORT = Number(process.env.PORT || 8787)

const ROUTES = {
  '/api/generate-narrative': 'generate-narrative',
  '/api/parse-clinical-notes': 'parse-clinical-notes',
  '/api/suggest-requirements': 'suggest-requirements',
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function parseJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const operation = ROUTES[url.pathname]

  if (!operation) return sendJson(res, 404, { error: 'Not found' })
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = await parseJsonBody(req)
  } catch (e) {
    return sendJson(res, 400, { error: e.message })
  }

  await handle(operation, body, res)
})

server.listen(PORT, () => {
  // Detect a missing OR obviously-fake key (placeholder text, wrong prefix,
  // suspiciously short). Real Anthropic keys start with `sk-ant-` and are
  // ~108 chars. This check would have caught the .env.local placeholder
  // bug — surfaces it loudly so the user sees it in the terminal before
  // hitting confused 502s in the browser.
  const key = process.env.ANTHROPIC_API_KEY
  const looksLikePlaceholder =
    !key ||
    key === 'sk-ant-...' ||
    key === 'your-key-here' ||
    !key.startsWith('sk-ant-') ||
    key.length < 50

  if (looksLikePlaceholder) {
    console.warn('')
    console.warn('  ⚠️  ANTHROPIC_API_KEY in .env.local is missing or invalid.')
    console.warn('     Edit .env.local to set a real key:')
    console.warn('       ANTHROPIC_API_KEY=sk-ant-api03-…your-key-here…')
    console.warn('     Get one at https://console.anthropic.com → Settings → API Keys.')
    console.warn('     AI features will not work until this is fixed.')
    console.warn('')
  }

  console.log(`PerioFlow API server listening on http://localhost:${PORT}`)
  console.log('  POST /api/generate-narrative')
  console.log('  POST /api/parse-clinical-notes')
  console.log('  POST /api/suggest-requirements')
})
