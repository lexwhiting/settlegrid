/**
 * settlegrid-world-trade — WTO Trade Data MCP Server
 *
 * Wraps the WTO Timeseries API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_trade_data(reporter, year?)  — Get trade data (2\u00A2)
 *   list_indicators()                — List indicators (1\u00A2)
 *   search_topics(query)             — Search topics (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TradeDataInput {
  reporter: string
  year?: string
}

interface SearchTopicsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.wto.org/timeseries/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-trade/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WTO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-trade',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_trade_data: { costCents: 2, displayName: 'Get trade data for a reporter country' },
      list_indicators: { costCents: 1, displayName: 'List available WTO indicators' },
      search_topics: { costCents: 1, displayName: 'Search WTO data topics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTradeData = sg.wrap(async (args: TradeDataInput) => {
  if (!args.reporter || typeof args.reporter !== 'string') {
    throw new Error('reporter is required (ISO3 country code, e.g. USA)')
  }
  const params: Record<string, string> = { r: args.reporter.toUpperCase(), i: 'HS_M_0010' }
  if (args.year) params.ps = args.year
  return apiFetch<unknown>('/data', params)
}, { method: 'get_trade_data' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const searchTopics = sg.wrap(async (args: SearchTopicsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/topics', { q: args.query })
}, { method: 'search_topics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTradeData, listIndicators, searchTopics }

console.log('settlegrid-world-trade MCP server ready')
console.log('Methods: get_trade_data, list_indicators, search_topics')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
