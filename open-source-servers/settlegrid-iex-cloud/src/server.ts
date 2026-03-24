/**
 * settlegrid-iex-cloud — IEX Cloud Stock Data MCP Server
 *
 * Wraps the IEX Cloud API with SettleGrid billing.
 * Requires IEX_TOKEN environment variable.
 *
 * Methods:
 *   get_quote(symbol)      — Real-time quote     (2¢)
 *   get_company(symbol)    — Company info         (2¢)
 *   get_stats(symbol)      — Key statistics       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://cloud.iexapis.com/stable'

function getKey(): string {
  const k = process.env.IEX_TOKEN
  if (!k) throw new Error('IEX_TOKEN environment variable is required')
  return k
}

async function iexFetch<T>(path: string): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('token', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-iex-cloud/1.0 (contact@settlegrid.ai)' },
  })
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
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Stock Quote' },
      get_company: { costCents: 2, displayName: 'Company Info' },
      get_stats: { costCents: 2, displayName: 'Key Stats' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(`/stock/${sym}/quote`)
  return data
}, { method: 'get_quote' })

const getCompany = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(`/stock/${sym}/company`)
  return data
}, { method: 'get_company' })

const getStats = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(`/stock/${sym}/stats`)
  return data
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getCompany, getStats }

console.log('settlegrid-iex-cloud MCP server ready')
console.log('Methods: get_quote, get_company, get_stats')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
