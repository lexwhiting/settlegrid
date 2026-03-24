/**
 * settlegrid-dummyjson — DummyJSON MCP Server
 *
 * Wraps the DummyJSON API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_products()                           (1¢)
 *   search_products(q)                       (1¢)
 *   get_quotes()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetProductsInput {
  limit?: number
  skip?: number
}

interface SearchProductsInput {
  q: string
}

interface GetQuotesInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dummyjson.com'
const USER_AGENT = 'settlegrid-dummyjson/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`DummyJSON API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dummyjson',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_products: { costCents: 1, displayName: 'Get list of products' },
      search_products: { costCents: 1, displayName: 'Search products by query' },
      get_quotes: { costCents: 1, displayName: 'Get random quotes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProducts = sg.wrap(async (args: GetProductsInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.skip !== undefined) params['skip'] = String(args.skip)

  const data = await apiFetch<Record<string, unknown>>('/products', {
    params,
  })

  return data
}, { method: 'get_products' })

const searchProducts = sg.wrap(async (args: SearchProductsInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q

  const data = await apiFetch<Record<string, unknown>>('/products/search', {
    params,
  })

  return data
}, { method: 'search_products' })

const getQuotes = sg.wrap(async (args: GetQuotesInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/quotes', {
    params,
  })

  return data
}, { method: 'get_quotes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProducts, searchProducts, getQuotes }

console.log('settlegrid-dummyjson MCP server ready')
console.log('Methods: get_products, search_products, get_quotes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
