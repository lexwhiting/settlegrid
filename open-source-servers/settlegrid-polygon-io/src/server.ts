/**
 * settlegrid-polygon-io — Polygon.io Market Data MCP Server
 *
 * Wraps the Polygon.io API with SettleGrid billing.
 * Requires POLYGON_API_KEY environment variable.
 *
 * Methods:
 *   get_ticker_details(ticker)        — Ticker details     (2¢)
 *   get_daily_bars(ticker, from, to)  — Daily OHLCV bars   (2¢)
 *   get_previous_close(ticker)        — Previous close     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DetailsInput { ticker: string }
interface BarsInput { ticker: string; from: string; to: string }
interface PrevCloseInput { ticker: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.polygon.io'

function getKey(): string {
  const k = process.env.POLYGON_API_KEY
  if (!k) throw new Error('POLYGON_API_KEY environment variable is required')
  return k
}

async function pgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apiKey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-polygon-io/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Polygon.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'polygon-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_ticker_details: { costCents: 2, displayName: 'Ticker Details' },
      get_daily_bars: { costCents: 2, displayName: 'Daily Bars' },
      get_previous_close: { costCents: 2, displayName: 'Previous Close' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTickerDetails = sg.wrap(async (args: DetailsInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (e.g. "AAPL")')
  }
  const data = await pgFetch<{ results: Record<string, unknown> }>(`/v3/reference/tickers/${encodeURIComponent(args.ticker.toUpperCase().trim())}`)
  return data.results
}, { method: 'get_ticker_details' })

const getDailyBars = sg.wrap(async (args: BarsInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required')
  }
  if (!args.from || !/^\d{4}-\d{2}-\d{2}$/.test(args.from)) {
    throw new Error('from is required (YYYY-MM-DD)')
  }
  if (!args.to || !/^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
    throw new Error('to is required (YYYY-MM-DD)')
  }
  const ticker = args.ticker.toUpperCase().trim()
  const data = await pgFetch<{ results: Array<Record<string, unknown>>; resultsCount: number }>(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${args.from}/${args.to}`
  )
  return { ticker, from: args.from, to: args.to, count: data.resultsCount, bars: data.results ?? [] }
}, { method: 'get_daily_bars' })

const getPreviousClose = sg.wrap(async (args: PrevCloseInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (e.g. "AAPL")')
  }
  const ticker = args.ticker.toUpperCase().trim()
  const data = await pgFetch<{ results: Array<Record<string, unknown>> }>(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev`
  )
  return { ticker, previousClose: data.results?.[0] ?? null }
}, { method: 'get_previous_close' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTickerDetails, getDailyBars, getPreviousClose }

console.log('settlegrid-polygon-io MCP server ready')
console.log('Methods: get_ticker_details, get_daily_bars, get_previous_close')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
