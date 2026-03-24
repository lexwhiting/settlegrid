/**
 * settlegrid-finnhub — Finnhub Stock Data MCP Server
 *
 * Wraps the Finnhub API with SettleGrid billing.
 * Requires FINNHUB_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)                 — Real-time quote         (2¢)
 *   get_company_profile(symbol)       — Company profile         (2¢)
 *   get_company_news(symbol,from,to)  — Company news            (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuoteInput { symbol: string }
interface ProfileInput { symbol: string }
interface NewsInput { symbol: string; from: string; to: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://finnhub.io/api/v1'

function getKey(): string {
  const k = process.env.FINNHUB_API_KEY
  if (!k) throw new Error('FINNHUB_API_KEY environment variable is required')
  return k
}

async function fhFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('token', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-finnhub/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Finnhub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'finnhub',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Stock Quote' },
      get_company_profile: { costCents: 2, displayName: 'Company Profile' },
      get_company_news: { costCents: 2, displayName: 'Company News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: QuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fhFetch<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>('/quote', { symbol: args.symbol.toUpperCase().trim() })
  return {
    symbol: args.symbol.toUpperCase(),
    current: data.c,
    change: data.d,
    changePercent: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
    timestamp: data.t,
  }
}, { method: 'get_quote' })

const getCompanyProfile = sg.wrap(async (args: ProfileInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fhFetch<Record<string, unknown>>('/stock/profile2', { symbol: args.symbol.toUpperCase().trim() })
  return data
}, { method: 'get_company_profile' })

const getCompanyNews = sg.wrap(async (args: NewsInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required')
  }
  if (!args.from || !/^\d{4}-\d{2}-\d{2}$/.test(args.from)) {
    throw new Error('from is required (YYYY-MM-DD)')
  }
  if (!args.to || !/^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
    throw new Error('to is required (YYYY-MM-DD)')
  }
  const data = await fhFetch<Array<Record<string, unknown>>>('/company-news', {
    symbol: args.symbol.toUpperCase().trim(),
    from: args.from,
    to: args.to,
  })
  const items = Array.isArray(data) ? data.slice(0, 20) : []
  return { symbol: args.symbol.toUpperCase(), from: args.from, to: args.to, count: items.length, articles: items }
}, { method: 'get_company_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getCompanyProfile, getCompanyNews }

console.log('settlegrid-finnhub MCP server ready')
console.log('Methods: get_quote, get_company_profile, get_company_news')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
