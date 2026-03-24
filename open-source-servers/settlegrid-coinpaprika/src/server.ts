/**
 * settlegrid-coinpaprika — Coinpaprika MCP Server
 *
 * Cryptocurrency market data, tickers, and coin details from Coinpaprika.
 *
 * Methods:
 *   list_coins()                  — Get list of all cryptocurrencies  (1¢)
 *   get_ticker(coin_id)           — Get ticker data for a specific coin  (1¢)
 *   search_coins(query)           — Search coins by name  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListCoinsInput {

}

interface GetTickerInput {
  coin_id: string
}

interface SearchCoinsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.coinpaprika.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-coinpaprika/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Coinpaprika API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinpaprika',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_coins: { costCents: 1, displayName: 'List Coins' },
      get_ticker: { costCents: 1, displayName: 'Coin Ticker' },
      search_coins: { costCents: 1, displayName: 'Search Coins' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCoins = sg.wrap(async (args: ListCoinsInput) => {

  const data = await apiFetch<any>(`/coins`)
  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    rank: data.rank,
    is_active: data.is_active,
    type: data.type,
  }
}, { method: 'list_coins' })

const getTicker = sg.wrap(async (args: GetTickerInput) => {
  if (!args.coin_id || typeof args.coin_id !== 'string') throw new Error('coin_id is required')
  const coin_id = args.coin_id.trim()
  const data = await apiFetch<any>(`/tickers/${encodeURIComponent(coin_id)}`)
  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    rank: data.rank,
    quotes: data.quotes,
  }
}, { method: 'get_ticker' })

const searchCoins = sg.wrap(async (args: SearchCoinsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}&c=currencies&limit=10`)
  const items = (data.currencies ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        rank: item.rank,
    })),
  }
}, { method: 'search_coins' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCoins, getTicker, searchCoins }

console.log('settlegrid-coinpaprika MCP server ready')
console.log('Methods: list_coins, get_ticker, search_coins')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
