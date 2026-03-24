/**
 * settlegrid-coingecko-markets — CoinGecko Markets MCP Server
 *
 * Wraps CoinGecko free API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_trending() — trending coins (1¢)
 *   get_global_market() — global market data (1¢)
 *   get_exchanges(limit?) — top exchanges (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ExchangeInput { limit?: number }

const API_BASE = 'https://api.coingecko.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'coingecko-markets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_trending: { costCents: 1, displayName: 'Trending Coins' },
      get_global_market: { costCents: 1, displayName: 'Global Market' },
      get_exchanges: { costCents: 1, displayName: 'Top Exchanges' },
    },
  },
})

const getTrending = sg.wrap(async () => {
  const data = await apiFetch<any>('/search/trending')
  return {
    coins: (data.coins || []).map((c: any) => ({
      name: c.item.name, symbol: c.item.symbol, rank: c.item.market_cap_rank,
      price_btc: c.item.price_btc, score: c.item.score,
    })),
  }
}, { method: 'get_trending' })

const getGlobalMarket = sg.wrap(async () => {
  const data = await apiFetch<any>('/global')
  const g = data.data
  return {
    active_coins: g.active_cryptocurrencies, markets: g.markets,
    total_market_cap_usd: g.total_market_cap?.usd,
    total_volume_usd: g.total_volume?.usd,
    btc_dominance: g.market_cap_percentage?.btc,
    eth_dominance: g.market_cap_percentage?.eth,
    change_24h: g.market_cap_change_percentage_24h_usd,
  }
}, { method: 'get_global_market' })

const getExchanges = sg.wrap(async (args: ExchangeInput) => {
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(`/exchanges?per_page=${limit}&page=1`)
  return {
    exchanges: data.map((e: any) => ({
      id: e.id, name: e.name, country: e.country, trust_score: e.trust_score,
      volume_btc_24h: e.trade_volume_24h_btc, year: e.year_established,
    })),
  }
}, { method: 'get_exchanges' })

export { getTrending, getGlobalMarket, getExchanges }

console.log('settlegrid-coingecko-markets MCP server ready')
console.log('Methods: get_trending, get_global_market, get_exchanges')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
