/**
 * settlegrid-star-catalog — Star & Constellation Data MCP Server
 * Wraps Le Systeme Solaire API with SettleGrid billing.
 * Methods:
 *   list_constellations()      — List constellations (1¢)
 *   search_stars(query, limit?) — Search stars (1¢)
 *   get_constellation(id)      — Get constellation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface ConstellationInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.le-systeme-solaire.net/rest'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-star-catalog/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Star Catalog API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'star-catalog',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_constellations: { costCents: 1, displayName: 'List constellations' },
      search_stars: { costCents: 1, displayName: 'Search stars' },
      get_constellation: { costCents: 1, displayName: 'Get constellation details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listConstellations = sg.wrap(async () => {
  return apiFetch<unknown>('bodies', {
    'filter[]': 'bodyType,eq,Star',
  })
}, { method: 'list_constellations' })

const searchStars = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  const data = await apiFetch<{ bodies?: Array<{ name: string; [k: string]: unknown }> }>('bodies')
  const filtered = (data.bodies || [])
    .filter((b: { name: string }) => b.name.toLowerCase().includes(args.query.toLowerCase()))
    .slice(0, limit)
  return { results: filtered, count: filtered.length }
}, { method: 'search_stars' })

const getConstellation = sg.wrap(async (args: ConstellationInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(`bodies/${encodeURIComponent(args.id)}`)
}, { method: 'get_constellation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listConstellations, searchStars, getConstellation }

console.log('settlegrid-star-catalog MCP server ready')
console.log('Methods: list_constellations, search_stars, get_constellation')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
