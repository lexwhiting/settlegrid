/**
 * settlegrid-coingecko — CoinGecko MCP Server
 *
 * Wraps the CoinGecko API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_price(ids)                           (1¢)
 *   get_coin(id)                             (2¢)
 *   get_trending()                           (1¢)
 *   search_coins(query)                      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPriceInput {
  ids: string
  vs_currencies?: string
}

interface GetCoinInput {
  id: string
}

interface GetTrendingInput {
}

interface SearchCoinsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.coingecko.com/api/v3'
const USER_AGENT = 'settlegrid-coingecko/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`CoinGecko API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coingecko',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_price: { costCents: 1, displayName: 'Get current price for cryptocurrencies' },
      get_coin: { costCents: 2, displayName: 'Get detailed coin data including description and l' },
      get_trending: { costCents: 1, displayName: 'Get trending coins in the last 24 hours' },
      search_coins: { costCents: 1, displayName: 'Search for coins by name or symbol' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: GetPriceInput) => {
  if (!args.ids || typeof args.ids !== 'string') {
    throw new Error('ids is required (coin ids comma-separated (e.g. bitcoin,ethereum))')
  }

  const params: Record<string, string> = {}
  params['ids'] = args.ids
  if (args.vs_currencies !== undefined) params['vs_currencies'] = String(args.vs_currencies)

  const data = await apiFetch<Record<string, unknown>>('/simple/price', {
    params,
  })

  return data
}, { method: 'get_price' })

const getCoin = sg.wrap(async (args: GetCoinInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (coin id (e.g. bitcoin))')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/coins/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_coin' })

const getTrending = sg.wrap(async (args: GetTrendingInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/search/trending', {
    params,
  })

  return data
}, { method: 'get_trending' })

const searchCoins = sg.wrap(async (args: SearchCoinsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  return data
}, { method: 'search_coins' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getCoin, getTrending, searchCoins }

console.log('settlegrid-coingecko MCP server ready')
console.log('Methods: get_price, get_coin, get_trending, search_coins')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
