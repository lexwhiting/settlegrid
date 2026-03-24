/**
 * settlegrid-trading-economics — Trading Economics MCP Server
 *
 * Wraps the Trading Economics API with SettleGrid billing.
 * Free tier available (guest access).
 *
 * Methods:
 *   get_indicators(country)      — Economic indicators    (1¢)
 *   get_markets(category)        — Market data            (1¢)
 *   get_forecasts(indicator)     — Economic forecasts     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndicatorsInput { country: string }
interface MarketsInput { category: string }
interface ForecastsInput { indicator: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tradingeconomics.com'
const UA = 'settlegrid-trading-economics/1.0 (contact@settlegrid.ai)'

async function teFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const key = process.env.TE_API_KEY
  if (key) url.searchParams.set('c', key)
  else url.searchParams.set('c', 'guest:guest')
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Trading Economics API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'trading-economics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'Economic Indicators' },
      get_markets: { costCents: 1, displayName: 'Market Data' },
      get_forecasts: { costCents: 1, displayName: 'Forecasts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async (args: IndicatorsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united states")')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(`/country/${encodeURIComponent(args.country.trim())}`)
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, indicators: data }
}, { method: 'get_indicators' })

const getMarkets = sg.wrap(async (args: MarketsInput) => {
  if (!args.category || typeof args.category !== 'string') {
    throw new Error('category is required (index, commodity, currency, bond)')
  }
  const validCategories = new Set(['index', 'commodity', 'currency', 'bond'])
  const cat = args.category.toLowerCase().trim()
  if (!validCategories.has(cat)) {
    throw new Error('category must be one of: index, commodity, currency, bond')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(`/markets/${cat}`)
  return { category: cat, count: Array.isArray(data) ? data.length : 0, markets: data }
}, { method: 'get_markets' })

const getForecasts = sg.wrap(async (args: ForecastsInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. "gdp")')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(`/forecast/indicator/${encodeURIComponent(args.indicator.trim())}`)
  return { indicator: args.indicator, count: Array.isArray(data) ? data.length : 0, forecasts: data }
}, { method: 'get_forecasts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, getMarkets, getForecasts }

console.log('settlegrid-trading-economics MCP server ready')
console.log('Methods: get_indicators, get_markets, get_forecasts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
