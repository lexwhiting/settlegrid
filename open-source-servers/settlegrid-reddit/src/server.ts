/**
 * settlegrid-reddit — Reddit Posts & Comments MCP Server
 *
 * Wraps the Reddit public JSON API with SettleGrid billing.
 * No API key needed for public .json endpoints.
 *
 * Methods:
 *   get_subreddit(subreddit, limit)  — Get hot posts      (1¢)
 *   search_posts(query, subreddit)   — Search posts       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubredditInput {
  subreddit: string
  limit?: number
}

interface SearchInput {
  query: string
  subreddit?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const REDDIT_BASE = 'https://www.reddit.com'

async function redditFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${REDDIT_BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-reddit/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Reddit API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatPost(p: any): Record<string, unknown> {
  const d = p.data
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score,
    numComments: d.num_comments,
    url: d.url,
    permalink: `https://www.reddit.com${d.permalink}`,
    selftext: d.selftext?.slice(0, 500) || '',
    createdUtc: new Date(d.created_utc * 1000).toISOString(),
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'reddit',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_subreddit: { costCents: 1, displayName: 'Get Subreddit' },
      search_posts: { costCents: 1, displayName: 'Search Posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSubreddit = sg.wrap(async (args: SubredditInput) => {
  if (!args.subreddit || typeof args.subreddit !== 'string') {
    throw new Error('subreddit is required (e.g. "programming")')
  }
  const sub = args.subreddit.replace(/^r\//, '').trim()
  if (!/^[a-zA-Z0-9_]{1,40}$/.test(sub)) {
    throw new Error('Invalid subreddit name')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const data = await redditFetch<{ data: { children: any[] } }>(
    `/r/${sub}/hot.json?limit=${limit}`
  )
  return {
    subreddit: sub,
    count: data.data.children.length,
    posts: data.data.children.map(formatPost),
  }
}, { method: 'get_subreddit' })

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const sub = args.subreddit ? `/r/${args.subreddit.replace(/^r\//, '')}` : ''
  const data = await redditFetch<{ data: { children: any[] } }>(
    `${sub}/search.json?q=${q}&limit=10&sort=relevance`
  )
  return {
    query: args.query,
    count: data.data.children.length,
    posts: data.data.children.map(formatPost),
  }
}, { method: 'search_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSubreddit, searchPosts }

console.log('settlegrid-reddit MCP server ready')
console.log('Methods: get_subreddit, search_posts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
