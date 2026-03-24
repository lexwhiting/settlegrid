/**
 * settlegrid-coinmarketcap — CoinMarketCap MCP Server
 *
 * Wraps the CoinMarketCap API with SettleGrid billing.
 * Requires CMC_API_KEY (header: X-CMC_PRO_API_KEY).
 *
 * Methods:
 *   get_listings(limit?)       — Top cryptos by market cap  (2¢)
 *   get_quotes(symbol)         — Quote for specific coins   (2¢)
 *   get_metadata(symbol)       — Coin metadata              (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListingsInput { limit?: number }
interface QuotesInput { symbol: string }
interface MetadataInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://pro-api.coinmarketcap.com/v1'

function getKey(): string {
  const k = process.env.CMC_API_KEY
  if (!k) throw new Error('CMC_API_KEY environment variable is required')
  return k
}

async function cmcFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'X-CMC_PRO_API_KEY': getKey(),
      Accept: 'application/json',
      'User-Agent': 'settlegrid-coinmarketcap/1.0 (contact@settlegrid.ai)',
    },
  })
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
    defaultCostCents: 2,
    methods: {
      get_listings: { costCents: 2, displayName: 'Crypto Listings' },
      get_quotes: { costCents: 2, displayName: 'Crypto Quotes' },
      get_metadata: { costCents: 2, displayName: 'Coin Metadata' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getListings = sg.wrap(async (args: ListingsInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await cmcFetch<{ data: Array<Record<string, unknown>> }>('/cryptocurrency/listings/latest', {
    limit: String(limit),
    convert: 'USD',
  })
  return { count: data.data.length, listings: data.data }
}, { method: 'get_listings' })

const getQuotes = sg.wrap(async (args: QuotesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTC" or "BTC,ETH")')
  }
  const data = await cmcFetch<{ data: Record<string, unknown> }>('/cryptocurrency/quotes/latest', {
    symbol: args.symbol.toUpperCase().trim(),
    convert: 'USD',
  })
  return data.data
}, { method: 'get_quotes' })

const getMetadata = sg.wrap(async (args: MetadataInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTC")')
  }
  const data = await cmcFetch<{ data: Record<string, unknown> }>('/cryptocurrency/info', {
    symbol: args.symbol.toUpperCase().trim(),
  })
  return data.data
}, { method: 'get_metadata' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getListings, getQuotes, getMetadata }

console.log('settlegrid-coinmarketcap MCP server ready')
console.log('Methods: get_listings, get_quotes, get_metadata')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
