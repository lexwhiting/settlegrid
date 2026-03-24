/**
 * settlegrid-polygon — Polygon.io MCP Server
 *
 * Wraps the Polygon.io API with SettleGrid billing.
 * Requires POLYGON_API_KEY environment variable.
 *
 * Methods:
 *   get_ticker_details(ticker)               (1¢)
 *   get_aggregates(ticker, from, to)         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTickerDetailsInput {
  ticker: string
}

interface GetAggregatesInput {
  ticker: string
  from: string
  to: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.polygon.io'
const USER_AGENT = 'settlegrid-polygon/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.POLYGON_API_KEY
  if (!key) throw new Error('POLYGON_API_KEY environment variable is required')
  return key
}

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
  url.searchParams.set('apiKey', getApiKey())
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
    throw new Error(`Polygon.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'polygon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker_details: { costCents: 1, displayName: 'Get detailed info about a ticker' },
      get_aggregates: { costCents: 2, displayName: 'Get aggregate bars for a ticker' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTickerDetails = sg.wrap(async (args: GetTickerDetailsInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (stock ticker (e.g. aapl))')
  }

  const params: Record<string, string> = {}
  params['ticker'] = String(args.ticker)

  const data = await apiFetch<Record<string, unknown>>(`/v3/reference/tickers/${encodeURIComponent(String(args.ticker))}`, {
    params,
  })

  return data
}, { method: 'get_ticker_details' })

const getAggregates = sg.wrap(async (args: GetAggregatesInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (stock ticker)')
  }
  if (!args.from || typeof args.from !== 'string') {
    throw new Error('from is required (start date yyyy-mm-dd)')
  }
  if (!args.to || typeof args.to !== 'string') {
    throw new Error('to is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['ticker'] = String(args.ticker)
  params['from'] = String(args.from)
  params['to'] = String(args.to)

  const data = await apiFetch<Record<string, unknown>>(`/v2/aggs/ticker/${encodeURIComponent(String(args.ticker))}/range/1/day/${encodeURIComponent(String(args.from))}/${encodeURIComponent(String(args.to))}`, {
    params,
  })

  return data
}, { method: 'get_aggregates' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTickerDetails, getAggregates }

console.log('settlegrid-polygon MCP server ready')
console.log('Methods: get_ticker_details, get_aggregates')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
