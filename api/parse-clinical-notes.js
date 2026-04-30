// Vercel serverless function: POST /api/parse-clinical-notes
// Reads ANTHROPIC_API_KEY from process.env (set in Vercel project settings).

import { handle } from './_anthropic.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  await handle('parse-clinical-notes', req.body, res)
}
