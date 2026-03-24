/**
 * settlegrid-usaspending — USASpending MCP Server
 *
 * Wraps the USASpending API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_spending(keyword)                 (2¢)
 *   get_agency(toptier_code)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchSpendingInput {
  keyword: string
  limit?: number
}

interface GetAgencyInput {
  toptier_code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.usaspending.gov/api/v2'
const USER_AGENT = 'settlegrid-usaspending/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`USASpending API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usaspending',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_spending: { costCents: 2, displayName: 'Search federal spending records' },
      get_agency: { costCents: 1, displayName: 'Get agency budget overview' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpending = sg.wrap(async (args: SearchSpendingInput) => {
  if (!args.keyword || typeof args.keyword !== 'string') {
    throw new Error('keyword is required (search keyword)')
  }

  const body: Record<string, unknown> = {}
  body['keyword'] = args.keyword
  if (args.limit !== undefined) body['limit'] = args.limit

  const data = await apiFetch<Record<string, unknown>>('/search/spending_by_award/', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'search_spending' })

const getAgency = sg.wrap(async (args: GetAgencyInput) => {
  if (!args.toptier_code || typeof args.toptier_code !== 'string') {
    throw new Error('toptier_code is required (agency code (e.g. 012 for usda))')
  }

  const params: Record<string, string> = {}
  params['toptier_code'] = String(args.toptier_code)

  const data = await apiFetch<Record<string, unknown>>(`/agency/${encodeURIComponent(String(args.toptier_code))}/`, {
    params,
  })

  return data
}, { method: 'get_agency' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpending, getAgency }

console.log('settlegrid-usaspending MCP server ready')
console.log('Methods: search_spending, get_agency')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
