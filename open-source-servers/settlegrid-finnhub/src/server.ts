/**
 * settlegrid-finnhub — Finnhub MCP Server
 *
 * Wraps the Finnhub API with SettleGrid billing.
 * Requires FINNHUB_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)                        (1¢)
 *   get_company_profile(symbol)              (1¢)
 *   get_company_news(symbol, from, to)       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetQuoteInput {
  symbol: string
}

interface GetCompanyProfileInput {
  symbol: string
}

interface GetCompanyNewsInput {
  symbol: string
  from: string
  to: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://finnhub.io/api/v1'
const USER_AGENT = 'settlegrid-finnhub/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY
  if (!key) throw new Error('FINNHUB_API_KEY environment variable is required')
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
    throw new Error(`Finnhub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'finnhub',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_quote: { costCents: 1, displayName: 'Get real-time stock quote' },
      get_company_profile: { costCents: 1, displayName: 'Get company profile and fundamentals' },
      get_company_news: { costCents: 2, displayName: 'Get latest company news articles' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: GetQuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker (e.g. aapl))')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol

  const data = await apiFetch<Record<string, unknown>>('/quote', {
    params,
  })

  return data
}, { method: 'get_quote' })

const getCompanyProfile = sg.wrap(async (args: GetCompanyProfileInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol

  const data = await apiFetch<Record<string, unknown>>('/stock/profile2', {
    params,
  })

  return data
}, { method: 'get_company_profile' })

const getCompanyNews = sg.wrap(async (args: GetCompanyNewsInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (stock ticker)')
  }
  if (!args.from || typeof args.from !== 'string') {
    throw new Error('from is required (start date yyyy-mm-dd)')
  }
  if (!args.to || typeof args.to !== 'string') {
    throw new Error('to is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['symbol'] = args.symbol
  params['from'] = args.from
  params['to'] = args.to

  const data = await apiFetch<Record<string, unknown>>('/company-news', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 20) : [data]

  return { symbol: args.symbol, from: args.from, to: args.to, count: items.length, results: items }
}, { method: 'get_company_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getCompanyProfile, getCompanyNews }

console.log('settlegrid-finnhub MCP server ready')
console.log('Methods: get_quote, get_company_profile, get_company_news')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
