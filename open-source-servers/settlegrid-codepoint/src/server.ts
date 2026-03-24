/**
 * settlegrid-codepoint — Unicode Codepoint Lookup MCP Server
 *
 * Look up Unicode character information and properties.
 *
 * Methods:
 *   lookup_codepoint(codepoint)   — Get information about a Unicode codepoint (e.g. "U+0041" or hex "0041")  (1¢)
 *   search_characters(query)      — Search Unicode characters by name  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupCodepointInput {
  codepoint: string
}

interface SearchCharactersInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.unicode.org/Public'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-codepoint/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Unicode Codepoint Lookup API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'codepoint',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_codepoint: { costCents: 1, displayName: 'Lookup Codepoint' },
      search_characters: { costCents: 1, displayName: 'Search Characters' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupCodepoint = sg.wrap(async (args: LookupCodepointInput) => {
  if (!args.codepoint || typeof args.codepoint !== 'string') throw new Error('codepoint is required')
  const codepoint = args.codepoint.trim()
  const data = await apiFetch<any>(`/codepoint/${encodeURIComponent(codepoint)}`)
  return {
    cp: data.cp,
    name: data.name,
    block: data.block,
    category: data.category,
    script: data.script,
  }
}, { method: 'lookup_codepoint' })

const searchCharacters = sg.wrap(async (args: SearchCharactersInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        cp: item.cp,
        name: item.name,
        block: item.block,
    })),
  }
}, { method: 'search_characters' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupCodepoint, searchCharacters }

console.log('settlegrid-codepoint MCP server ready')
console.log('Methods: lookup_codepoint, search_characters')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
