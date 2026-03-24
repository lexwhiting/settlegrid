/**
 * settlegrid-fossil-data — Fossil Record Data MCP Server
 * Wraps Paleobiology Database with SettleGrid billing.
 * Methods:
 *   search_fossils(query, limit?) — Search fossils (1¢)
 *   get_occurrence(id)            — Get occurrence (1¢)
 *   get_taxa(name)                — Get taxonomy (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface OccurrenceInput {
  id: string
}

interface TaxaInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://paleobiodb.org/data1.2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('show', 'full')
  url.searchParams.set('vocab', 'pbdb')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fossil-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PBDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fossil-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_fossils: { costCents: 1, displayName: 'Search fossils' },
      get_occurrence: { costCents: 1, displayName: 'Get occurrence' },
      get_taxa: { costCents: 2, displayName: 'Get taxonomy' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFossils = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 20, 100)
  return apiFetch<unknown>('occs/list.json', {
    base_name: args.query,
    limit: String(limit),
  })
}, { method: 'search_fossils' })

const getOccurrence = sg.wrap(async (args: OccurrenceInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('occs/single.json', { id: args.id })
}, { method: 'get_occurrence' })

const getTaxa = sg.wrap(async (args: TaxaInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required')
  }
  return apiFetch<unknown>('taxa/list.json', {
    base_name: args.name,
    rel: 'all_children',
    limit: '20',
  })
}, { method: 'get_taxa' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFossils, getOccurrence, getTaxa }

console.log('settlegrid-fossil-data MCP server ready')
console.log('Methods: search_fossils, get_occurrence, get_taxa')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
