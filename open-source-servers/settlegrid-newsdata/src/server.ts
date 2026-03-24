/**
 * settlegrid-newsdata — Newsdata.io MCP Server
 *
 * News articles by country, category, and language.
 *
 * Methods:
 *   search_news(q, country)       — Search news by keyword and country  (2¢)
 *   latest_news(country, category) — Get latest news by country  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchNewsInput {
  q: string
  country?: string
}

interface LatestNewsInput {
  country?: string
  category?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://newsdata.io/api/1'
const API_KEY = process.env.NEWSDATA_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-newsdata/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Newsdata.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'newsdata',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_news: { costCents: 2, displayName: 'Search News' },
      latest_news: { costCents: 2, displayName: 'Latest News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchNews = sg.wrap(async (args: SearchNewsInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const data = await apiFetch<any>(`/news?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}&apikey=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
        source_id: item.source_id,
    })),
  }
}, { method: 'search_news' })

const latestNews = sg.wrap(async (args: LatestNewsInput) => {
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const category = typeof args.category === 'string' ? args.category.trim() : ''
  const data = await apiFetch<any>(`/news?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&apikey=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
        source_id: item.source_id,
    })),
  }
}, { method: 'latest_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchNews, latestNews }

console.log('settlegrid-newsdata MCP server ready')
console.log('Methods: search_news, latest_news')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
