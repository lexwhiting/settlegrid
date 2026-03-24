/**
 * settlegrid-dev-to — DEV.to MCP Server
 *
 * Wraps the DEV.to API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_articles()                           (1¢)
 *   get_article(id)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetArticlesInput {
  tag?: string
  per_page?: number
}

interface GetArticleInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dev.to/api'
const USER_AGENT = 'settlegrid-dev-to/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`DEV.to API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dev-to',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_articles: { costCents: 1, displayName: 'Get published articles' },
      get_article: { costCents: 1, displayName: 'Get article by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getArticles = sg.wrap(async (args: GetArticlesInput) => {

  const params: Record<string, string> = {}
  if (args.tag !== undefined) params['tag'] = String(args.tag)
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/articles', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_articles' })

const getArticle = sg.wrap(async (args: GetArticleInput) => {
  if (typeof args.id !== 'number' || isNaN(args.id)) {
    throw new Error('id must be a number')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/articles/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_article' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getArticles, getArticle }

console.log('settlegrid-dev-to MCP server ready')
console.log('Methods: get_articles, get_article')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
