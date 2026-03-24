/**
 * settlegrid-reddit-news — Reddit News MCP Server
 *
 * Get top news posts from Reddit r/news and r/worldnews.
 *
 * Methods:
 *   get_news(sort)                — Get top posts from r/news  (1¢)
 *   get_worldnews(sort)           — Get top posts from r/worldnews  (1¢)
 *   search_subreddit(subreddit, q) — Search posts in a subreddit  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetNewsInput {
  sort?: string
}

interface GetWorldnewsInput {
  sort?: string
}

interface SearchSubredditInput {
  subreddit: string
  q: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.reddit.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-reddit-news/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Reddit News API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'reddit-news',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_news: { costCents: 1, displayName: 'Get News' },
      get_worldnews: { costCents: 1, displayName: 'Get World News' },
      search_subreddit: { costCents: 1, displayName: 'Search Subreddit' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getNews = sg.wrap(async (args: GetNewsInput) => {
  const sort = typeof args.sort === 'string' ? args.sort.trim() : ''
  const data = await apiFetch<any>(`/r/news/${encodeURIComponent(sort)}.json?limit=15`)
  const items = (data.data.children ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        data: item.data,
    })),
  }
}, { method: 'get_news' })

const getWorldnews = sg.wrap(async (args: GetWorldnewsInput) => {
  const sort = typeof args.sort === 'string' ? args.sort.trim() : ''
  const data = await apiFetch<any>(`/r/worldnews/${encodeURIComponent(sort)}.json?limit=15`)
  const items = (data.data.children ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        data: item.data,
    })),
  }
}, { method: 'get_worldnews' })

const searchSubreddit = sg.wrap(async (args: SearchSubredditInput) => {
  if (!args.subreddit || typeof args.subreddit !== 'string') throw new Error('subreddit is required')
  const subreddit = args.subreddit.trim()
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const data = await apiFetch<any>(`/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&limit=10`)
  const items = (data.data.children ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        data: item.data,
    })),
  }
}, { method: 'search_subreddit' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getNews, getWorldnews, searchSubreddit }

console.log('settlegrid-reddit-news MCP server ready')
console.log('Methods: get_news, get_worldnews, search_subreddit')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
