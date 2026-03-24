/**
 * settlegrid-binance — Binance Public Market Data MCP Server
 *
 * Wraps the public Binance API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_ticker(symbol)              — 24hr ticker         (1¢)
 *   get_depth(symbol, limit?)       — Order book depth    (1¢)
 *   get_klines(symbol, interval)    — Candlestick data    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TickerInput { symbol: string }
interface DepthInput { symbol: string; limit?: number }
interface KlinesInput { symbol: string; interval: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.binance.com/api/v3'

async function bnFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-binance/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Binance API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'binance',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker: { costCents: 1, displayName: '24hr Ticker' },
      get_depth: { costCents: 1, displayName: 'Order Book' },
      get_klines: { costCents: 1, displayName: 'Candlestick Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: TickerInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const data = await bnFetch<Record<string, string>>('/ticker/24hr', { symbol: args.symbol.toUpperCase().trim() })
  return {
    symbol: data.symbol,
    priceChange: data.priceChange,
    priceChangePercent: data.priceChangePercent,
    lastPrice: data.lastPrice,
    highPrice: data.highPrice,
    lowPrice: data.lowPrice,
    volume: data.volume,
    quoteVolume: data.quoteVolume,
  }
}, { method: 'get_ticker' })

const getDepth = sg.wrap(async (args: DepthInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 5), 50)
  const data = await bnFetch<{ bids: string[][]; asks: string[][] }>('/depth', {
    symbol: args.symbol.toUpperCase().trim(),
    limit: String(limit),
  })
  return {
    symbol: args.symbol.toUpperCase(),
    bids: data.bids.map(([price, qty]) => ({ price, quantity: qty })),
    asks: data.asks.map(([price, qty]) => ({ price, quantity: qty })),
  }
}, { method: 'get_depth' })

const getKlines = sg.wrap(async (args: KlinesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const validIntervals = new Set(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'])
  if (!args.interval || !validIntervals.has(args.interval)) {
    throw new Error('interval is required (1m, 5m, 15m, 1h, 4h, 1d, 1w, etc.)')
  }
  const data = await bnFetch<Array<Array<string | number>>>('/klines', {
    symbol: args.symbol.toUpperCase().trim(),
    interval: args.interval,
    limit: '50',
  })
  return {
    symbol: args.symbol.toUpperCase(),
    interval: args.interval,
    candles: data.map((k) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
    })),
  }
}, { method: 'get_klines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getDepth, getKlines }

console.log('settlegrid-binance MCP server ready')
console.log('Methods: get_ticker, get_depth, get_klines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
