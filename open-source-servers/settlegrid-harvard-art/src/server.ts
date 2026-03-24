/**
 * settlegrid-harvard-art — Harvard Art Museums MCP Server
 *
 * Wraps Harvard Art Museums API with SettleGrid billing.
 * Requires a free API key from https://harvardartmuseums.org/collections/api
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (1¢)
 *   get_object(id)                    — Get object details (1¢)
 *   search_people(query)              — Search people (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObjectsInput {
  query: string
  limit?: number
}

interface GetObjectInput {
  id: number
}

interface SearchPeopleInput {
  query: string
}

interface HAMRecord {
  id: number
  objectid: number
  objectnumber: string
  title: string
  dated: string
  classification: string
  medium: string
  primaryimageurl: string | null
  [key: string]: unknown
}

interface HAMSearchResult {
  info: { totalrecords: number; totalrecordsperquery: number; pages: number; page: number }
  records: HAMRecord[]
}

interface HAMPerson {
  personid: number
  displayname: string
  culture: string
  gender: string
  birthplace: string
  deathplace: string
  [key: string]: unknown
}

interface HAMPeopleResult {
  info: { totalrecords: number; pages: number; page: number }
  records: HAMPerson[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.harvardartmuseums.org'
const API_KEY = process.env.HAM_API_KEY ?? ''
const USER_AGENT = 'settlegrid-harvard-art/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('apikey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Harvard Art API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'harvard-art',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 1, displayName: 'Search objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      search_people: { costCents: 1, displayName: 'Search people' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['size'] = String(args.limit)
  return apiFetch<HAMSearchResult>('/object', params)
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (args.id === undefined || typeof args.id !== 'number') {
    throw new Error('id is required (numeric object ID)')
  }
  return apiFetch<Record<string, unknown>>(`/object/${args.id}`)
}, { method: 'get_object' })

const searchPeople = sg.wrap(async (args: SearchPeopleInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (person name)')
  }
  return apiFetch<HAMPeopleResult>('/person', { q: args.query })
}, { method: 'search_people' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, searchPeople }

console.log('settlegrid-harvard-art MCP server ready')
console.log('Methods: search_objects, get_object, search_people')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
