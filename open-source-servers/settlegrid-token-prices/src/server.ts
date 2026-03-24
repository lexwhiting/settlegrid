/**
 * settlegrid-token-prices — Multi-Chain Token Price MCP Server
 *
 * Wraps the free CoinGecko API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_price(token)       — Price for a single token     (1¢)
 *   get_prices(tokens[])   — Prices for multiple tokens   (1¢/token)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PriceInput {
  token: string
}

interface PricesInput {
  tokens: string[]
}

interface CoinGeckoPrice {
  usd: number
  usd_24h_change: number
  usd_market_cap: number
  usd_24h_vol: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CG_BASE = 'https://api.coingecko.com/api/v3'

async function cgFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CG_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CoinGecko API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateToken(token: unknown): string {
  if (!token || typeof token !== 'string') {
    throw new Error('token is required (e.g. "bitcoin", "ethereum")')
  }
  return token.toLowerCase().trim()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'token-prices',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_price: { costCents: 1, displayName: 'Single Token Price' },
      get_prices: { costCents: 1, displayName: 'Multi Token Prices' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: PriceInput) => {
  const token = validateToken(args.token)

  const data = await cgFetch<Record<string, CoinGeckoPrice>>(
    `/simple/price?ids=${encodeURIComponent(token)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
  )

  const price = data[token]
  if (!price) {
    throw new Error(`Token "${token}" not found. Use CoinGecko IDs like "bitcoin", "ethereum".`)
  }

  return {
    token,
    price: price.usd,
    change24h: Math.round((price.usd_24h_change ?? 0) * 100) / 100,
    marketCap: price.usd_market_cap ?? null,
    volume24h: price.usd_24h_vol ?? null,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_price' })

const getPrices = sg.wrap(async (args: PricesInput) => {
  if (!Array.isArray(args.tokens) || args.tokens.length === 0) {
    throw new Error('tokens must be a non-empty array of token IDs')
  }
  if (args.tokens.length > 50) {
    throw new Error('Maximum 50 tokens per request')
  }

  const tokens = args.tokens.map((t) => {
    if (typeof t !== 'string') throw new Error('Each token must be a string')
    return t.toLowerCase().trim()
  })

  const ids = tokens.join(',')
  const data = await cgFetch<Record<string, CoinGeckoPrice>>(
    `/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  )

  const prices = tokens.map((token) => {
    const price = data[token]
    return {
      token,
      price: price?.usd ?? null,
      change24h: price ? Math.round((price.usd_24h_change ?? 0) * 100) / 100 : null,
      marketCap: price?.usd_market_cap ?? null,
      found: !!price,
    }
  })

  return {
    count: prices.length,
    timestamp: new Date().toISOString(),
    prices,
  }
}, { method: 'get_prices' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getPrices }

console.log('settlegrid-token-prices MCP server ready')
console.log('Methods: get_price, get_prices')
console.log('Pricing: 1¢ per token | Powered by SettleGrid')
