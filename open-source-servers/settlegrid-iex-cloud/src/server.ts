/**
 * settlegrid-iex-cloud — IEX Cloud MCP Server
 *
 * Wraps the IEX Cloud API with SettleGrid billing.
 * Requires IEX_CLOUD_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)                        (1¢)
 *   get_stats(symbol)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetQuoteInput {
  symbol: string
}

interface GetStatsInput {
  symbol: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://cloud.iexapis.com/stable'
const USER_AGENT = 'settlegrid-iex-cloud/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.IEX_CLOUD_API_KEY
  if (!key) throw new Error('IEX_CLOUD_API_KEY environment variable is required')
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
  url.searchParams.set('token', getApiKey())
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
    throw new Error(`IEX Cloud API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'iex-cloud',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_quote: { costCents: 1, displayName: 'Get real-time stock quote' },
      get_stats: { costCents: 1, displayName: 'Get key financial stats for a company' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: GetQuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = String(args.symbol)

  const data = await apiFetch<Record<string, unknown>>(`/stock/${encodeURIComponent(String(args.symbol))}/quote`, {
    params,
  })

  return data
}, { method: 'get_quote' })

const getStats = sg.wrap(async (args: GetStatsInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = String(args.symbol)

  const data = await apiFetch<Record<string, unknown>>(`/stock/${encodeURIComponent(String(args.symbol))}/stats`, {
    params,
  })

  return data
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getStats }

console.log('settlegrid-iex-cloud MCP server ready')
console.log('Methods: get_quote, get_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
