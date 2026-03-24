/**
 * settlegrid-alpha-vantage — Alpha Vantage MCP Server
 *
 * Wraps the Alpha Vantage API with SettleGrid billing.
 * Requires ALPHA_VANTAGE_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)                        (1¢)
 *   get_daily(symbol)                        (2¢)
 *   search_symbol(keywords)                  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetQuoteInput {
  symbol: string
}

interface GetDailyInput {
  symbol: string
  outputsize?: string
}

interface SearchSymbolInput {
  keywords: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.alphavantage.co/query'
const USER_AGENT = 'settlegrid-alpha-vantage/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required')
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
    throw new Error(`Alpha Vantage API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'alpha-vantage',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_quote: { costCents: 1, displayName: 'Get real-time stock quote' },
      get_daily: { costCents: 2, displayName: 'Get daily price time series' },
      search_symbol: { costCents: 1, displayName: 'Search for stock symbols by name' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: GetQuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker (e.g. aapl, msft))')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_quote' })

const getDaily = sg.wrap(async (args: GetDailyInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol
  if (args.outputsize !== undefined) params['outputsize'] = String(args.outputsize)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_daily' })

const searchSymbol = sg.wrap(async (args: SearchSymbolInput) => {
  if (!args.keywords || typeof args.keywords !== 'string') {
    throw new Error('keywords is required (search keywords (e.g. apple, tesla))')
  }

  const params: Record<string, string> = {}
  params['keywords'] = args.keywords

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'search_symbol' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getDaily, searchSymbol }

console.log('settlegrid-alpha-vantage MCP server ready')
console.log('Methods: get_quote, get_daily, search_symbol')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
