/**
 * settlegrid-coingecko — CoinGecko Crypto MCP Server
 *
 * Wraps the free CoinGecko API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_price(ids, currency)   — Current prices          (1¢)
 *   get_coin(id)               — Detailed coin data      (1¢)
 *   get_trending()             — Trending coins           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PriceInput { ids: string; currency: string }
interface CoinInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.coingecko.com/api/v3'

async function cgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-coingecko/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
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
      get_price: { costCents: 1, displayName: 'Coin Prices' },
      get_coin: { costCents: 1, displayName: 'Coin Details' },
      get_trending: { costCents: 1, displayName: 'Trending Coins' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: PriceInput) => {
  if (!args.ids || typeof args.ids !== 'string') {
    throw new Error('ids is required (comma-separated coin IDs, e.g. "bitcoin,ethereum")')
  }
  if (!args.currency || typeof args.currency !== 'string') {
    throw new Error('currency is required (e.g. "usd")')
  }
  const data = await cgFetch<Record<string, Record<string, number>>>('/simple/price', {
    ids: args.ids.toLowerCase().trim(),
    vs_currencies: args.currency.toLowerCase().trim(),
    include_24hr_change: 'true',
    include_market_cap: 'true',
  })
  return { currency: args.currency.toLowerCase(), prices: data }
}, { method: 'get_price' })

const getCoin = sg.wrap(async (args: CoinInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "bitcoin")')
  }
  const data = await cgFetch<Record<string, unknown>>(`/coins/${encodeURIComponent(args.id.toLowerCase().trim())}`, {
    localization: 'false',
    tickers: 'false',
    community_data: 'false',
    developer_data: 'false',
  })
  return data
}, { method: 'get_coin' })

const getTrending = sg.wrap(async () => {
  const data = await cgFetch<{ coins: Array<{ item: Record<string, unknown> }> }>('/search/trending')
  return {
    coins: (data.coins ?? []).map((c) => c.item),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getCoin, getTrending }

console.log('settlegrid-coingecko MCP server ready')
console.log('Methods: get_price, get_coin, get_trending')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
