/**
 * settlegrid-devto — DEV.to Articles MCP Server
 *
 * Wraps the DEV.to (Forem) API with SettleGrid billing.
 * API key optional for public read operations.
 *
 * Methods:
 *   get_articles(tag, per_page)       — Get articles    (1¢)
 *   search_articles(query, per_page)  — Search articles (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ArticlesInput {
  tag?: string
  per_page?: number
}

interface SearchInput {
  query: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEV_BASE = 'https://dev.to/api'
const API_KEY = process.env.DEVTO_API_KEY || ''

async function devFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (API_KEY) headers['api-key'] = API_KEY
  const res = await fetch(`${DEV_BASE}${path}`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DEV.to API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatArticle(a: any): Record<string, unknown> {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    url: a.url,
    tags: a.tag_list || a.tags,
    author: a.user?.name || a.user?.username,
    publishedAt: a.published_at,
    positiveReactions: a.positive_reactions_count,
    comments: a.comments_count,
    readingTime: a.reading_time_minutes,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'devto',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_articles: { costCents: 1, displayName: 'Get Articles' },
      search_articles: { costCents: 1, displayName: 'Search Articles' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getArticles = sg.wrap(async (args: ArticlesInput) => {
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  let url = `/articles?per_page=${perPage}`
  if (args.tag) url += `&tag=${encodeURIComponent(args.tag)}`
  const data = await devFetch<any[]>(url)
  return {
    tag: args.tag || null,
    count: data.length,
    articles: data.map(formatArticle),
  }
}, { method: 'get_articles' })

const searchArticles = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await devFetch<any[]>(`/articles?per_page=${perPage}&search=${q}`)
  return {
    query: args.query,
    count: data.length,
    articles: data.map(formatArticle),
  }
}, { method: 'search_articles' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getArticles, searchArticles }

console.log('settlegrid-devto MCP server ready')
console.log('Methods: get_articles, search_articles')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
