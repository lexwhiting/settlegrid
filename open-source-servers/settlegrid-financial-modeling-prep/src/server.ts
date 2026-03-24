/**
 * settlegrid-financial-modeling-prep — Financial Modeling Prep MCP Server
 *
 * Wraps the Financial Modeling Prep API with SettleGrid billing.
 * Requires FMP_API_KEY environment variable.
 *
 * Methods:
 *   get_profile(symbol)                      (1¢)
 *   get_income_statement(symbol)             (2¢)
 *   get_gainers_losers()                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetProfileInput {
  symbol: string
}

interface GetIncomeStatementInput {
  symbol: string
  limit?: number
}

interface GetGainersLosersInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://financialmodelingprep.com/api/v3'
const USER_AGENT = 'settlegrid-financial-modeling-prep/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) throw new Error('FMP_API_KEY environment variable is required')
  return key
}

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
  url.searchParams.set('apikey', getApiKey())
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
    throw new Error(`Financial Modeling Prep API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'financial-modeling-prep',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_profile: { costCents: 1, displayName: 'Get company financial profile' },
      get_income_statement: { costCents: 2, displayName: 'Get annual income statement' },
      get_gainers_losers: { costCents: 1, displayName: 'Get top gainers and losers today' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: GetProfileInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker (e.g. aapl))')
  }

  const params: Record<string, string> = {}
  params['symbol'] = String(args.symbol)

  const data = await apiFetch<Record<string, unknown>>(`/profile/${encodeURIComponent(String(args.symbol))}`, {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 1) : [data]

  return { symbol: args.symbol, count: items.length, results: items }
}, { method: 'get_profile' })

const getIncomeStatement = sg.wrap(async (args: GetIncomeStatementInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>(`/income-statement/${encodeURIComponent(String(args.symbol))}`, {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { symbol: args.symbol, count: items.length, results: items }
}, { method: 'get_income_statement' })

const getGainersLosers = sg.wrap(async (args: GetGainersLosersInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/stock_market/gainers', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 20) : [data]

  return { count: items.length, results: items }
}, { method: 'get_gainers_losers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getIncomeStatement, getGainersLosers }

console.log('settlegrid-financial-modeling-prep MCP server ready')
console.log('Methods: get_profile, get_income_statement, get_gainers_losers')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
