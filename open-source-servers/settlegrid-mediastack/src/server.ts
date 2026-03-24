/**
 * settlegrid-mediastack — Mediastack MCP Server
 *
 * Real-time and historical news articles from 7,500+ sources.
 *
 * Methods:
 *   search_news(keywords, languages) — Search news articles by keyword  (2¢)
 *   get_sources(countries)        — List available news sources  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchNewsInput {
  keywords: string
  languages?: string
}

interface GetSourcesInput {
  countries?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.mediastack.com/v1'
const API_KEY = process.env.MEDIASTACK_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-mediastack/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mediastack API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mediastack',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_news: { costCents: 2, displayName: 'Search News' },
      get_sources: { costCents: 2, displayName: 'Get Sources' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchNews = sg.wrap(async (args: SearchNewsInput) => {
  if (!args.keywords || typeof args.keywords !== 'string') throw new Error('keywords is required')
  const keywords = args.keywords.trim()
  const languages = typeof args.languages === 'string' ? args.languages.trim() : ''
  const data = await apiFetch<any>(`/news?keywords=${encodeURIComponent(keywords)}&languages=${encodeURIComponent(languages)}&limit=10&access_key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        published_at: item.published_at,
        description: item.description,
    })),
  }
}, { method: 'search_news' })

const getSources = sg.wrap(async (args: GetSourcesInput) => {
  const countries = typeof args.countries === 'string' ? args.countries.trim() : ''
  const data = await apiFetch<any>(`/sources?countries=${encodeURIComponent(countries)}&limit=20&access_key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        url: item.url,
        country: item.country,
        language: item.language,
        category: item.category,
    })),
  }
}, { method: 'get_sources' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchNews, getSources }

console.log('settlegrid-mediastack MCP server ready')
console.log('Methods: search_news, get_sources')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
