// Vercel serverless function: POST /api/suggest-requirements
// Reads ANTHROPIC_API_KEY from process.env.

import { handle } from './_anthropic.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  await handle('suggest-requirements', req.body, res)
}
