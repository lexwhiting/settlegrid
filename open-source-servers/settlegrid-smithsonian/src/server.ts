/**
 * settlegrid-smithsonian — Smithsonian Open Access MCP Server
 *
 * Wraps Smithsonian Open Access API with SettleGrid billing.
 * Requires a free API key from https://api.si.edu
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (1¢)
 *   get_object(id)                    — Get object details (1¢)
 *   get_stats()                       — Get collection stats (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObjectsInput {
  query: string
  limit?: number
}

interface GetObjectInput {
  id: string
}

interface SmithsonianRow {
  id: string
  title: string
  unitCode: string
  type: string
  url: string
  content: Record<string, unknown>
}

interface SmithsonianSearchResult {
  status: number
  responseCode: number
  rowCount: number
  rows: SmithsonianRow[]
}

interface SmithsonianStatsResult {
  status: number
  response: Record<string, unknown>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.si.edu/openaccess/api/v1.0'
const API_KEY = process.env.SMITHSONIAN_API_KEY ?? ''
const USER_AGENT = 'settlegrid-smithsonian/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Smithsonian API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'smithsonian',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 1, displayName: 'Search Smithsonian objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      get_stats: { costCents: 1, displayName: 'Get collection statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  return apiFetch<SmithsonianSearchResult>('/search', params)
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Smithsonian object ID)')
  }
  return apiFetch<Record<string, unknown>>(`/content/${args.id}`)
}, { method: 'get_object' })

const getStats = sg.wrap(async () => {
  return apiFetch<SmithsonianStatsResult>('/stats')
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, getStats }

console.log('settlegrid-smithsonian MCP server ready')
console.log('Methods: search_objects, get_object, get_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
