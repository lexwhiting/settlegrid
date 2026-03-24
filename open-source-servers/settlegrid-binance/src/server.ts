/**
 * settlegrid-binance — Binance MCP Server
 *
 * Wraps the Binance API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_ticker(symbol)                       (1¢)
 *   get_klines(symbol, interval)             (2¢)
 *   get_orderbook(symbol)                    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTickerInput {
  symbol: string
}

interface GetKlinesInput {
  symbol: string
  interval: string
  limit?: number
}

interface GetOrderbookInput {
  symbol: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.binance.com/api/v3'
const USER_AGENT = 'settlegrid-binance/1.0 (contact@settlegrid.ai)'

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
      get_ticker: { costCents: 1, displayName: 'Get 24hr price change statistics' },
      get_klines: { costCents: 2, displayName: 'Get candlestick/kline data' },
      get_orderbook: { costCents: 1, displayName: 'Get current order book depth' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: GetTickerInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (trading pair (e.g. btcusdt))')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol

  const data = await apiFetch<Record<string, unknown>>('/ticker/24hr', {
    params,
  })

  return data
}, { method: 'get_ticker' })

const getKlines = sg.wrap(async (args: GetKlinesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (trading pair (e.g. btcusdt))')
  }
  if (!args.interval || typeof args.interval !== 'string') {
    throw new Error('interval is required (interval: 1m,5m,1h,1d,1w)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol
  params['interval'] = args.interval
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/klines', {
    params,
  })

  return data
}, { method: 'get_klines' })

const getOrderbook = sg.wrap(async (args: GetOrderbookInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (trading pair)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/depth', {
    params,
  })

  return data
}, { method: 'get_orderbook' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getKlines, getOrderbook }

console.log('settlegrid-binance MCP server ready')
console.log('Methods: get_ticker, get_klines, get_orderbook')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
