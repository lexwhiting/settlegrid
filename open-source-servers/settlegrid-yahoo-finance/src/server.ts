/**
 * settlegrid-yahoo-finance — Yahoo Finance MCP Server
 *
 * Wraps the Yahoo Finance API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_chart(symbol)                        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetChartInput {
  symbol: string
  range?: string
  interval?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://query1.finance.yahoo.com/v8/finance'
const USER_AGENT = 'settlegrid-yahoo-finance/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Yahoo Finance API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'yahoo-finance',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_chart: { costCents: 2, displayName: 'Get price chart data for a ticker' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getChart = sg.wrap(async (args: GetChartInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker (e.g. aapl))')
  }

  const params: Record<string, string> = {}
  if (args.range !== undefined) params['range'] = String(args.range)
  if (args.interval !== undefined) params['interval'] = String(args.interval)

  const data = await apiFetch<Record<string, unknown>>(`/chart/${encodeURIComponent(String(args.symbol))}`, {
    params,
  })

  return data
}, { method: 'get_chart' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getChart }

console.log('settlegrid-yahoo-finance MCP server ready')
console.log('Methods: get_chart')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
