/**
 * settlegrid-emoji-data — Emoji Data MCP Server
 *
 * Wraps Open Emoji API with SettleGrid billing.
 * Free key from https://emoji-api.com/.
 *
 * Methods:
 *   search_emoji(query) — search emojis (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

const API_KEY = process.env.EMOJI_API_KEY || ''

const sg = settlegrid.init({
  toolSlug: 'emoji-data',
  pricing: { defaultCostCents: 1, methods: { search_emoji: { costCents: 1, displayName: 'Search Emoji' } } },
})

const searchEmoji = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('EMOJI_API_KEY not set')
  const res = await fetch(`https://emoji-api.com/emojis?search=${encodeURIComponent(args.query)}&access_key=${API_KEY}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json() as any
  if (!Array.isArray(data)) return { emojis: [], message: 'No emojis found' }
  return {
    emojis: data.slice(0, 20).map((e: any) => ({
      character: e.character, name: e.unicodeName, slug: e.slug,
      group: e.group, sub_group: e.subGroup, codePoint: e.codePoint,
    })),
  }
}, { method: 'search_emoji' })

export { searchEmoji }

console.log('settlegrid-emoji-data MCP server ready')
console.log('Methods: search_emoji')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
