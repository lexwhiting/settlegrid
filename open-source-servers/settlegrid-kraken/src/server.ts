/**
 * settlegrid-kraken — Kraken Public Market Data MCP Server
 *
 * Wraps the public Kraken API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_ticker(pair)              — Ticker info          (1¢)
 *   get_ohlc(pair, interval?)     — OHLC candles         (1¢)
 *   get_assets()                  — List assets          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TickerInput { pair: string }
interface OhlcInput { pair: string; interval?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.kraken.com/0/public'

async function krFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-kraken/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Kraken API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { error: string[]; result: T }
  if (json.error && json.error.length > 0) {
    throw new Error(`Kraken API error: ${json.error.join(', ')}`)
  }
  return json.result
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'kraken',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker: { costCents: 1, displayName: 'Ticker Info' },
      get_ohlc: { costCents: 1, displayName: 'OHLC Data' },
      get_assets: { costCents: 1, displayName: 'List Assets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: TickerInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (e.g. "XBTUSD")')
  }
  const data = await krFetch<Record<string, Record<string, unknown>>>('/Ticker', { pair: args.pair.toUpperCase().trim() })
  return { pair: args.pair.toUpperCase(), ticker: data }
}, { method: 'get_ticker' })

const getOhlc = sg.wrap(async (args: OhlcInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (e.g. "XBTUSD")')
  }
  const validIntervals = new Set([1, 5, 15, 30, 60, 240, 1440, 10080, 21600])
  const interval = args.interval ?? 60
  if (!validIntervals.has(interval)) {
    throw new Error('interval must be one of: 1, 5, 15, 30, 60, 240, 1440, 10080, 21600')
  }
  const data = await krFetch<Record<string, unknown>>('/OHLC', {
    pair: args.pair.toUpperCase().trim(),
    interval: String(interval),
  })
  return { pair: args.pair.toUpperCase(), interval, data }
}, { method: 'get_ohlc' })

const getAssets = sg.wrap(async () => {
  const data = await krFetch<Record<string, Record<string, unknown>>>('/Assets')
  return { count: Object.keys(data).length, assets: data }
}, { method: 'get_assets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getOhlc, getAssets }

console.log('settlegrid-kraken MCP server ready')
console.log('Methods: get_ticker, get_ohlc, get_assets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
