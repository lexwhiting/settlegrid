/**
 * settlegrid-meme-gen — Meme Generation MCP Server
 *
 * Generate memes using Imgflip. Free account needed.
 *
 * Methods:
 *   get_meme_templates()              (1¢)
 *   generate_meme(template_id, text0, text1) (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GenerateMemeInput { template_id: string; text0: string; text1: string }

const API_BASE = 'https://api.imgflip.com'
const USER_AGENT = 'settlegrid-meme-gen/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'meme-gen',
  pricing: { defaultCostCents: 1, methods: {
    get_meme_templates: { costCents: 1, displayName: 'Get popular meme templates' },
    generate_meme: { costCents: 2, displayName: 'Generate a meme' },
  }},
})

const getMemeTemplates = sg.wrap(async () => {
  const res = await fetch(`${API_BASE}/get_memes`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Imgflip API ${res.status}`)
  const data = await res.json() as { data: { memes: unknown[] } }
  const memes = data.data.memes.slice(0, 50)
  return { count: memes.length, templates: memes }
}, { method: 'get_meme_templates' })

const generateMeme = sg.wrap(async (args: GenerateMemeInput) => {
  if (!args.template_id || !args.text0) throw new Error('template_id and text0 are required')
  const username = process.env.IMGFLIP_USERNAME || ''
  const password = process.env.IMGFLIP_PASSWORD || ''
  if (!username || !password) throw new Error('IMGFLIP_USERNAME and IMGFLIP_PASSWORD are required')
  const body = new URLSearchParams({
    template_id: args.template_id,
    username,
    password,
    text0: args.text0,
    text1: args.text1 || '',
  })
  const res = await fetch(`${API_BASE}/caption_image`, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Imgflip API ${res.status}`)
  return await res.json()
}, { method: 'generate_meme' })

export { getMemeTemplates, generateMeme }

console.log('settlegrid-meme-gen MCP server ready')
console.log('Methods: get_meme_templates, generate_meme')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
