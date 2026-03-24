/**
 * settlegrid-kraken — Kraken MCP Server
 *
 * Wraps the Kraken API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_ticker(pair)                         (1¢)
 *   get_ohlc(pair)                           (2¢)
 *   get_assets()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTickerInput {
  pair: string
}

interface GetOhlcInput {
  pair: string
  interval?: number
}

interface GetAssetsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.kraken.com/0/public'
const USER_AGENT = 'settlegrid-kraken/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Kraken API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'kraken',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker: { costCents: 1, displayName: 'Get ticker information for a trading pair' },
      get_ohlc: { costCents: 2, displayName: 'Get OHLC candle data' },
      get_assets: { costCents: 1, displayName: 'Get list of tradable assets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: GetTickerInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (trading pair (e.g. xbtusd))')
  }

  const params: Record<string, string> = {}
  params['pair'] = args.pair

  const data = await apiFetch<Record<string, unknown>>('/Ticker', {
    params,
  })

  return data
}, { method: 'get_ticker' })

const getOhlc = sg.wrap(async (args: GetOhlcInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (trading pair)')
  }

  const params: Record<string, string> = {}
  params['pair'] = args.pair
  if (args.interval !== undefined) params['interval'] = String(args.interval)

  const data = await apiFetch<Record<string, unknown>>('/OHLC', {
    params,
  })

  return data
}, { method: 'get_ohlc' })

const getAssets = sg.wrap(async (args: GetAssetsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/Assets', {
    params,
  })

  return data
}, { method: 'get_assets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getOhlc, getAssets }

console.log('settlegrid-kraken MCP server ready')
console.log('Methods: get_ticker, get_ohlc, get_assets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
