/**
 * settlegrid-fdic — FDIC Bank Data MCP Server
 *
 * Wraps the FDIC Bank Data API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_institutions()                    (1¢)
 *   get_failures()                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInstitutionsInput {
  filters?: string
  limit?: number
}

interface GetFailuresInput {
  limit?: number
  sort_by?: string
  sort_order?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://banks.data.fdic.gov/api'
const USER_AGENT = 'settlegrid-fdic/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`FDIC Bank Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fdic',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_institutions: { costCents: 1, displayName: 'Search for FDIC-insured institutions' },
      get_failures: { costCents: 1, displayName: 'Get list of bank failures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchInstitutions = sg.wrap(async (args: SearchInstitutionsInput) => {

  const params: Record<string, string> = {}
  if (args.filters !== undefined) params['filters'] = String(args.filters)
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/financials', {
    params,
  })

  return data
}, { method: 'search_institutions' })

const getFailures = sg.wrap(async (args: GetFailuresInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.sort_by !== undefined) params['sort_by'] = String(args.sort_by)
  if (args.sort_order !== undefined) params['sort_order'] = String(args.sort_order)

  const data = await apiFetch<Record<string, unknown>>('/failures', {
    params,
  })

  return data
}, { method: 'get_failures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchInstitutions, getFailures }

console.log('settlegrid-fdic MCP server ready')
console.log('Methods: search_institutions, get_failures')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
