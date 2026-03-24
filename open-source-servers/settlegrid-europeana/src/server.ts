/**
 * settlegrid-europeana — Europeana Cultural Heritage MCP Server
 *
 * Wraps Europeana API with SettleGrid billing.
 * Requires a free API key from https://pro.europeana.eu
 *
 * Methods:
 *   search_records(query, limit?)     — Search records (1¢)
 *   get_record(id)                    — Get record details (1¢)
 *   search_collections(query)         — Search collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRecordsInput {
  query: string
  limit?: number
}

interface GetRecordInput {
  id: string
}

interface SearchCollectionsInput {
  query: string
}

interface EuropeanaItem {
  id: string
  title: string[]
  type: string
  dataProvider: string[]
  edmPreview?: string[]
  [key: string]: unknown
}

interface EuropeanaSearchResult {
  success: boolean
  totalResults: number
  items: EuropeanaItem[]
}

interface EuropeanaRecordResult {
  success: boolean
  object: {
    about: string
    title: Record<string, string[]>
    type: string
    europeanaAggregation: Record<string, unknown>
    [key: string]: unknown
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.europeana.eu/record/v2'
const API_KEY = process.env.EUROPEANA_API_KEY ?? ''
const USER_AGENT = 'settlegrid-europeana/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('wskey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Europeana API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'europeana',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_records: { costCents: 1, displayName: 'Search Europeana records' },
      get_record: { costCents: 1, displayName: 'Get record by ID' },
      search_collections: { costCents: 1, displayName: 'Search collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRecords = sg.wrap(async (args: SearchRecordsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { query: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  return apiFetch<EuropeanaSearchResult>('/search.json', params)
}, { method: 'search_records' })

const getRecord = sg.wrap(async (args: GetRecordInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Europeana record ID)')
  }
  const cleanId = args.id.startsWith('/') ? args.id : `/${args.id}`
  return apiFetch<EuropeanaRecordResult>(`${cleanId}.json`)
}, { method: 'get_record' })

const searchCollections = sg.wrap(async (args: SearchCollectionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (collection search)')
  }
  return apiFetch<EuropeanaSearchResult>('/search.json', {
    query: `*:*`,
    qf: `PROVIDER:"${args.query}"`,
    rows: '20',
    profile: 'facets',
  })
}, { method: 'search_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRecords, getRecord, searchCollections }

console.log('settlegrid-europeana MCP server ready')
console.log('Methods: search_records, get_record, search_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
