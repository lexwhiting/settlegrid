/**
 * settlegrid-newsapi — NewsAPI MCP Server
 *
 * Search news articles from 80,000+ sources worldwide via NewsAPI.
 *
 * Methods:
 *   search_articles(q, language)  — Search news articles by keyword  (2¢)
 *   top_headlines(country, category) — Get top headlines by country or category  (2¢)
 *   get_sources(language)         — List available news sources  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArticlesInput {
  q: string
  language?: string
}

interface TopHeadlinesInput {
  country?: string
  category?: string
}

interface GetSourcesInput {
  language?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://newsapi.org/v2'
const API_KEY = process.env.NEWSAPI_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-newsapi/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NewsAPI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'newsapi',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_articles: { costCents: 2, displayName: 'Search Articles' },
      top_headlines: { costCents: 2, displayName: 'Top Headlines' },
      get_sources: { costCents: 2, displayName: 'Get Sources' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArticles = sg.wrap(async (args: SearchArticlesInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/everything?q=${encodeURIComponent(q)}&language=${encodeURIComponent(language)}&pageSize=10&apiKey=${API_KEY}`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
        description: item.description,
    })),
  }
}, { method: 'search_articles' })

const topHeadlines = sg.wrap(async (args: TopHeadlinesInput) => {
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const category = typeof args.category === 'string' ? args.category.trim() : ''
  const data = await apiFetch<any>(`/top-headlines?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&pageSize=10&apiKey=${API_KEY}`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
        description: item.description,
    })),
  }
}, { method: 'top_headlines' })

const getSources = sg.wrap(async (args: GetSourcesInput) => {
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/top-headlines/sources?language=${encodeURIComponent(language)}&apiKey=${API_KEY}`)
  const items = (data.sources ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.url,
        category: item.category,
        language: item.language,
    })),
  }
}, { method: 'get_sources' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArticles, topHeadlines, getSources }

console.log('settlegrid-newsapi MCP server ready')
console.log('Methods: search_articles, top_headlines, get_sources')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
