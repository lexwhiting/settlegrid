/**
 * settlegrid-gnews — GNews MCP Server
 *
 * Search Google News articles by keyword, topic, or country.
 *
 * Methods:
 *   search_news(q, lang)          — Search news articles by keyword  (2¢)
 *   top_headlines(topic, country) — Get top headlines by topic or country  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchNewsInput {
  q: string
  lang?: string
}

interface TopHeadlinesInput {
  topic?: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://gnews.io/api/v4'
const API_KEY = process.env.GNEWS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-gnews/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GNews API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gnews',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_news: { costCents: 2, displayName: 'Search News' },
      top_headlines: { costCents: 2, displayName: 'Top Headlines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchNews = sg.wrap(async (args: SearchNewsInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const lang = typeof args.lang === 'string' ? args.lang.trim() : ''
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}&max=10&apikey=${API_KEY}`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        description: item.description,
        source: item.source,
    })),
  }
}, { method: 'search_news' })

const topHeadlines = sg.wrap(async (args: TopHeadlinesInput) => {
  const topic = typeof args.topic === 'string' ? args.topic.trim() : ''
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const data = await apiFetch<any>(`/top-headlines?topic=${encodeURIComponent(topic)}&country=${encodeURIComponent(country)}&max=10&apikey=${API_KEY}`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        description: item.description,
        source: item.source,
    })),
  }
}, { method: 'top_headlines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchNews, topHeadlines }

console.log('settlegrid-gnews MCP server ready')
console.log('Methods: search_news, top_headlines')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
