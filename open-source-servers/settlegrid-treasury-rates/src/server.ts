/**
 * settlegrid-treasury-rates — US Treasury Rates MCP Server
 *
 * Wraps the US Treasury Rates API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_rates()                              (1¢)
 *   get_debt()                               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRatesInput {
  sort?: string
  page_size?: number
}

interface GetDebtInput {
  sort?: string
  page_size?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'
const USER_AGENT = 'settlegrid-treasury-rates/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`US Treasury Rates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'treasury-rates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_rates: { costCents: 1, displayName: 'Get daily Treasury interest rates' },
      get_debt: { costCents: 1, displayName: 'Get US public debt data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRates = sg.wrap(async (args: GetRatesInput) => {

  const params: Record<string, string> = {}
  if (args.sort !== undefined) params['sort'] = String(args.sort)
  if (args.page_size !== undefined) params['page[size]'] = String(args.page_size)

  const data = await apiFetch<Record<string, unknown>>('/v2/accounting/od/avg_interest_rates', {
    params,
  })

  return data
}, { method: 'get_rates' })

const getDebt = sg.wrap(async (args: GetDebtInput) => {

  const params: Record<string, string> = {}
  if (args.sort !== undefined) params['sort'] = String(args.sort)
  if (args.page_size !== undefined) params['page[size]'] = String(args.page_size)

  const data = await apiFetch<Record<string, unknown>>('/v2/accounting/od/debt_to_penny', {
    params,
  })

  return data
}, { method: 'get_debt' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRates, getDebt }

console.log('settlegrid-treasury-rates MCP server ready')
console.log('Methods: get_rates, get_debt')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
