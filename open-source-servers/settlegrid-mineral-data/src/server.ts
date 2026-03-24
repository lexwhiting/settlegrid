/**
 * settlegrid-mineral-data — Mineral Database MCP Server
 * Wraps Mindat API with SettleGrid billing.
 * Methods:
 *   search_minerals(query, limit?) — Search minerals (1¢)
 *   get_mineral(id)                — Get mineral details (1¢)
 *   list_chemical_groups()         — List chemical groups (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface MineralInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.mindat.org'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-mineral-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mindat API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mineral-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_minerals: { costCents: 1, displayName: 'Search minerals' },
      get_mineral: { costCents: 1, displayName: 'Get mineral details' },
      list_chemical_groups: { costCents: 1, displayName: 'List chemical groups' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMinerals = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('/minerals_ima.json', {
    name: args.query,
    page_size: String(limit),
  })
}, { method: 'search_minerals' })

const getMineral = sg.wrap(async (args: MineralInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(`/minerals_ima/${encodeURIComponent(args.id)}.json`)
}, { method: 'get_mineral' })

const listChemicalGroups = sg.wrap(async () => {
  return apiFetch<unknown>('/minerals_ima.json', {
    fields: 'ima_chemistry,name',
    page_size: '50',
  })
}, { method: 'list_chemical_groups' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMinerals, getMineral, listChemicalGroups }

console.log('settlegrid-mineral-data MCP server ready')
console.log('Methods: search_minerals, get_mineral, list_chemical_groups')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
