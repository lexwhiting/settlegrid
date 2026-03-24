/**
 * settlegrid-alpha-vantage — Alpha Vantage Stock Data MCP Server
 *
 * Wraps the Alpha Vantage API with SettleGrid billing.
 * Requires ALPHA_VANTAGE_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)           — Real-time stock quote    (2¢)
 *   get_daily(symbol)           — Daily time series        (2¢)
 *   search_symbol(keywords)     — Search ticker symbols    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuoteInput { symbol: string }
interface DailyInput { symbol: string }
interface SearchInput { keywords: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.alphavantage.co/query'

function getKey(): string {
  const k = process.env.ALPHA_VANTAGE_API_KEY
  if (!k) throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required')
  return k
}

async function avFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-alpha-vantage/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Alpha Vantage API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'alpha-vantage',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Real-time Quote' },
      get_daily: { costCents: 2, displayName: 'Daily Time Series' },
      search_symbol: { costCents: 2, displayName: 'Symbol Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: QuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'GLOBAL_QUOTE',
    symbol: args.symbol.toUpperCase().trim(),
  })
  const q = (data['Global Quote'] ?? data) as Record<string, string>
  return {
    symbol: q['01. symbol'] ?? args.symbol,
    price: q['05. price'],
    change: q['09. change'],
    changePercent: q['10. change percent'],
    volume: q['06. volume'],
    latestDay: q['07. latest trading day'],
  }
}, { method: 'get_quote' })

const getDaily = sg.wrap(async (args: DailyInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "MSFT")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'TIME_SERIES_DAILY',
    symbol: args.symbol.toUpperCase().trim(),
    outputsize: 'compact',
  })
  const ts = (data['Time Series (Daily)'] ?? {}) as Record<string, Record<string, string>>
  const days = Object.entries(ts).slice(0, 30).map(([date, v]) => ({
    date,
    open: v['1. open'],
    high: v['2. high'],
    low: v['3. low'],
    close: v['4. close'],
    volume: v['5. volume'],
  }))
  return { symbol: args.symbol.toUpperCase(), count: days.length, timeSeries: days }
}, { method: 'get_daily' })

const searchSymbol = sg.wrap(async (args: SearchInput) => {
  if (!args.keywords || typeof args.keywords !== 'string') {
    throw new Error('keywords is required (e.g. "apple")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'SYMBOL_SEARCH',
    keywords: args.keywords.trim(),
  })
  const matches = (data['bestMatches'] ?? []) as Array<Record<string, string>>
  return {
    query: args.keywords,
    count: matches.length,
    results: matches.map((m) => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
      type: m['3. type'],
      region: m['4. region'],
      currency: m['8. currency'],
    })),
  }
}, { method: 'search_symbol' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getDaily, searchSymbol }

console.log('settlegrid-alpha-vantage MCP server ready')
console.log('Methods: get_quote, get_daily, search_symbol')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
