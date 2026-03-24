/**
 * settlegrid-archaeology — Archaeological Site Data MCP Server
 * Wraps Open Context API with SettleGrid billing.
 * Methods:
 *   search_sites(query, limit?) — Search sites (1¢)
 *   get_item(id)                — Get item details (1¢)
 *   list_projects()             — List projects (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface ItemInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://opencontext.org'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-archaeology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Context API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'archaeology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_sites: { costCents: 1, displayName: 'Search archaeological sites' },
      get_item: { costCents: 1, displayName: 'Get item details' },
      list_projects: { costCents: 1, displayName: 'List projects' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSites = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('/search/.json', {
    q: args.query,
    rows: String(limit),
  })
}, { method: 'search_sites' })

const getItem = sg.wrap(async (args: ItemInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const path = args.id.startsWith('/') ? args.id : `/subjects/${args.id}`
  return apiFetch<unknown>(`${path}.json`)
}, { method: 'get_item' })

const listProjects = sg.wrap(async () => {
  return apiFetch<unknown>('/projects/.json', { rows: '25' })
}, { method: 'list_projects' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSites, getItem, listProjects }

console.log('settlegrid-archaeology MCP server ready')
console.log('Methods: search_sites, get_item, list_projects')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
