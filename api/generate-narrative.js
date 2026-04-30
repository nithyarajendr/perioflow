// Vercel serverless function: POST /api/generate-narrative
// Reads ANTHROPIC_API_KEY from process.env (set in Vercel project settings).

import { handle } from './_anthropic.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Vercel auto-parses JSON when Content-Type: application/json
  await handle('generate-narrative', req.body, res)
}
