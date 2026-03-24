/**
 * settlegrid-coinmarketcap — CoinMarketCap MCP Server
 *
 * Wraps the CoinMarketCap API with SettleGrid billing.
 * Requires COINMARKETCAP_API_KEY environment variable.
 *
 * Methods:
 *   get_listings()                           (2¢)
 *   get_quotes(symbol)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetListingsInput {
  limit?: number
  sort?: string
}

interface GetQuotesInput {
  symbol: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pro-api.coinmarketcap.com/v1'
const USER_AGENT = 'settlegrid-coinmarketcap/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.COINMARKETCAP_API_KEY
  if (!key) throw new Error('COINMARKETCAP_API_KEY environment variable is required')
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'X-CMC_PRO_API_KEY': `${getApiKey()}`,
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
    throw new Error(`CoinMarketCap API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinmarketcap',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_listings: { costCents: 2, displayName: 'Get latest cryptocurrency listings with market dat' },
      get_quotes: { costCents: 1, displayName: 'Get price quotes for specific cryptocurrencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getListings = sg.wrap(async (args: GetListingsInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.sort !== undefined) params['sort'] = String(args.sort)

  const data = await apiFetch<Record<string, unknown>>('/cryptocurrency/listings/latest', {
    params,
  })

  return data
}, { method: 'get_listings' })

const getQuotes = sg.wrap(async (args: GetQuotesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (comma-separated symbols (e.g. btc,eth))')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol

  const data = await apiFetch<Record<string, unknown>>('/cryptocurrency/quotes/latest', {
    params,
  })

  return data
}, { method: 'get_quotes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getListings, getQuotes }

console.log('settlegrid-coinmarketcap MCP server ready')
console.log('Methods: get_listings, get_quotes')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
