/**
 * settlegrid-nyt — New York Times MCP Server
 *
 * Search NYT articles, top stories, and book reviews.
 *
 * Methods:
 *   search_articles(q)            — Search NYT articles by keyword  (2¢)
 *   top_stories(section)          — Get top stories by section  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArticlesInput {
  q: string
}

interface TopStoriesInput {
  section: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.nytimes.com/svc'
const API_KEY = process.env.NYT_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nyt/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`New York Times API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nyt',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_articles: { costCents: 2, displayName: 'Search Articles' },
      top_stories: { costCents: 2, displayName: 'Top Stories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArticles = sg.wrap(async (args: SearchArticlesInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const data = await apiFetch<any>(`/search/v2/articlesearch.json?q=${encodeURIComponent(q)}&api-key=${API_KEY}`)
  const items = (data.response.docs ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        headline: item.headline,
        web_url: item.web_url,
        pub_date: item.pub_date,
        abstract: item.abstract,
        section_name: item.section_name,
    })),
  }
}, { method: 'search_articles' })

const topStories = sg.wrap(async (args: TopStoriesInput) => {
  if (!args.section || typeof args.section !== 'string') throw new Error('section is required')
  const section = args.section.trim()
  const data = await apiFetch<any>(`/topstories/v2/${encodeURIComponent(section)}.json?api-key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        url: item.url,
        published_date: item.published_date,
        abstract: item.abstract,
        section: item.section,
    })),
  }
}, { method: 'top_stories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArticles, topStories }

console.log('settlegrid-nyt MCP server ready')
console.log('Methods: search_articles, top_stories')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
