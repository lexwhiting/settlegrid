/**
 * settlegrid-british-museum — British Museum Collection MCP Server
 *
 * Wraps British Museum Collection search with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (2¢)
 *   get_object(id)                    — Get object details (1¢)
 *   search_by_period(period)          — Search by period (2¢)
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

interface SearchByPeriodInput {
  period: string
}

interface BMObject {
  id: string
  title: string
  description: string
  department: string
  period: string
  materials: string[]
  image?: string
  [key: string]: unknown
}

interface BMSearchResult {
  hits: number
  objects: BMObject[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://collection.britishmuseum.org'
const USER_AGENT = 'settlegrid-british-museum/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`British Museum API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'british-museum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 2, displayName: 'Search British Museum objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      search_by_period: { costCents: 2, displayName: 'Search by historical period' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const limit = args.limit ?? 10
  return apiFetch<BMSearchResult>('/search', {
    q: args.query,
    size: String(limit),
  })
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (British Museum object ID)')
  }
  return apiFetch<Record<string, unknown>>(`/object/${args.id}`)
}, { method: 'get_object' })

const searchByPeriod = sg.wrap(async (args: SearchByPeriodInput) => {
  if (!args.period || typeof args.period !== 'string') {
    throw new Error('period is required (e.g. Roman, Medieval, Egyptian)')
  }
  return apiFetch<BMSearchResult>('/search', {
    q: '*',
    period: args.period,
    size: '20',
  })
}, { method: 'search_by_period' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, searchByPeriod }

console.log('settlegrid-british-museum MCP server ready')
console.log('Methods: search_objects, get_object, search_by_period')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
