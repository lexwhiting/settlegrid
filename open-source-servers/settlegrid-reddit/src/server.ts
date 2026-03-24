/**
 * settlegrid-reddit — Reddit MCP Server
 *
 * Wraps the Reddit API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_subreddit(subreddit)                 (1¢)
 *   search(q)                                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetSubredditInput {
  subreddit: string
  limit?: number
}

interface SearchInput {
  q: string
  sort?: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.reddit.com'
const USER_AGENT = 'settlegrid-reddit/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Reddit API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'reddit',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_subreddit: { costCents: 1, displayName: 'Get hot posts from a subreddit' },
      search: { costCents: 1, displayName: 'Search Reddit posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSubreddit = sg.wrap(async (args: GetSubredditInput) => {
  if (!args.subreddit || typeof args.subreddit !== 'string') {
    throw new Error('subreddit is required (subreddit name (e.g. programming))')
  }

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>(`/r/${encodeURIComponent(String(args.subreddit))}/hot.json`, {
    params,
  })

  return data
}, { method: 'get_subreddit' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.sort !== undefined) params['sort'] = String(args.sort)
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/search.json', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSubreddit, search }

console.log('settlegrid-reddit MCP server ready')
console.log('Methods: get_subreddit, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
