/**
 * settlegrid-openfda — OpenFDA MCP Server
 *
 * Wraps the OpenFDA API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_drugs(search)                     (1¢)
 *   get_recalls(search)                      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDrugsInput {
  search: string
  limit?: number
}

interface GetRecallsInput {
  search: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fda.gov'
const USER_AGENT = 'settlegrid-openfda/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenFDA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openfda',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_drugs: { costCents: 1, displayName: 'Search drug adverse event reports' },
      get_recalls: { costCents: 1, displayName: 'Search food and drug recalls' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDrugs = sg.wrap(async (args: SearchDrugsInput) => {
  if (!args.search || typeof args.search !== 'string') {
    throw new Error('search is required (search query (e.g. patient.drug.medicinalproduct:aspirin))')
  }

  const params: Record<string, string> = {}
  params['search'] = args.search
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/drug/event.json', {
    params,
  })

  return data
}, { method: 'search_drugs' })

const getRecalls = sg.wrap(async (args: GetRecallsInput) => {
  if (!args.search || typeof args.search !== 'string') {
    throw new Error('search is required (search query)')
  }

  const params: Record<string, string> = {}
  params['search'] = args.search
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/drug/enforcement.json', {
    params,
  })

  return data
}, { method: 'get_recalls' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDrugs, getRecalls }

console.log('settlegrid-openfda MCP server ready')
console.log('Methods: search_drugs, get_recalls')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
