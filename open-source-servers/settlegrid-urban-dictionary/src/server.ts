/**
 * settlegrid-urban-dictionary — Urban Dictionary MCP Server
 *
 * Wraps the Urban Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define(term)    — Look up slang definition  (1¢)
 *   random()        — Random definitions        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DefineInput { term: string }

interface UrbanEntry {
  definition: string
  permalink: string
  thumbs_up: number
  thumbs_down: number
  author: string
  word: string
  written_on: string
  example: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.urbandictionary.com/v0'

async function urbanFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Urban Dictionary API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatEntry(e: UrbanEntry) {
  return {
    word: e.word,
    definition: e.definition.replace(/\[|\]/g, '').slice(0, 500),
    example: e.example.replace(/\[|\]/g, '').slice(0, 300),
    author: e.author,
    thumbsUp: e.thumbs_up,
    thumbsDown: e.thumbs_down,
    permalink: e.permalink,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'urban-dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define: { costCents: 1, displayName: 'Define Slang' },
      random: { costCents: 1, displayName: 'Random Definitions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const define = sg.wrap(async (args: DefineInput) => {
  if (!args.term || typeof args.term !== 'string') throw new Error('term is required')
  const term = args.term.trim()
  if (term.length === 0 || term.length > 100) throw new Error('term must be 1-100 characters')
  const data = await urbanFetch<{ list: UrbanEntry[] }>(`/define?term=${encodeURIComponent(term)}`)
  const sorted = data.list.sort((a, b) => b.thumbs_up - a.thumbs_up)
  return { term, count: sorted.length, definitions: sorted.slice(0, 10).map(formatEntry) }
}, { method: 'define' })

const random = sg.wrap(async () => {
  const data = await urbanFetch<{ list: UrbanEntry[] }>('/random')
  return { definitions: data.list.slice(0, 10).map(formatEntry) }
}, { method: 'random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { define, random }

console.log('settlegrid-urban-dictionary MCP server ready')
console.log('Methods: define, random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
