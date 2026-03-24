/**
 * settlegrid-currents — Currents API MCP Server
 *
 * Latest news and current events from around the world.
 *
 * Methods:
 *   search_news(keywords, language) — Search current news by keyword  (2¢)
 *   latest_news(language)         — Get latest news articles  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchNewsInput {
  keywords: string
  language?: string
}

interface LatestNewsInput {
  language?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.currentsapi.services/v1'
const API_KEY = process.env.CURRENTS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-currents/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Currents API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'currents',
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
  if (!args.keywords || typeof args.keywords !== 'string') throw new Error('keywords is required')
  const keywords = args.keywords.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/search?keywords=${encodeURIComponent(keywords)}&language=${encodeURIComponent(language)}&apiKey=${API_KEY}`)
  const items = (data.news ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        published: item.published,
        description: item.description,
        category: item.category,
    })),
  }
}, { method: 'search_news' })

const latestNews = sg.wrap(async (args: LatestNewsInput) => {
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/latest-news?language=${encodeURIComponent(language)}&apiKey=${API_KEY}`)
  const items = (data.news ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        published: item.published,
        description: item.description,
        category: item.category,
    })),
  }
}, { method: 'latest_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchNews, latestNews }

console.log('settlegrid-currents MCP server ready')
console.log('Methods: search_news, latest_news')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
