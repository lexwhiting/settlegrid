/**
 * settlegrid-worldnewsapi — World News API MCP Server
 *
 * Search world news articles by keyword, language, or country.
 *
 * Methods:
 *   search_news(text, language)   — Search news articles by keyword  (2¢)
 *   get_top_news(source_country)  — Get top news by country  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchNewsInput {
  text: string
  language?: string
}

interface GetTopNewsInput {
  source_country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.worldnewsapi.com'
const API_KEY = process.env.WORLDNEWS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-worldnewsapi/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World News API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'worldnewsapi',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_news: { costCents: 2, displayName: 'Search News' },
      get_top_news: { costCents: 2, displayName: 'Top News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchNews = sg.wrap(async (args: SearchNewsInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  const text = args.text.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/search-news?text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}&number=10&api-key=${API_KEY}`)
  const items = (data.news ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        publish_date: item.publish_date,
        text: item.text,
        source_country: item.source_country,
    })),
  }
}, { method: 'search_news' })

const getTopNews = sg.wrap(async (args: GetTopNewsInput) => {
  if (!args.source_country || typeof args.source_country !== 'string') throw new Error('source_country is required')
  const source_country = args.source_country.trim()
  const data = await apiFetch<any>(`/top-news?source-country=${encodeURIComponent(source_country)}&language=en&api-key=${API_KEY}`)
  const items = (data.top_news ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        publish_date: item.publish_date,
        text: item.text,
    })),
  }
}, { method: 'get_top_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchNews, getTopNews }

console.log('settlegrid-worldnewsapi MCP server ready')
console.log('Methods: search_news, get_top_news')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
