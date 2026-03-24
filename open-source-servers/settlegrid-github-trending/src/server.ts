/**
 * settlegrid-github-trending — GitHub Trending MCP Server
 *
 * Wraps the GitHub Trending API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_trending_repos()                     (1¢)
 *   get_trending_developers()                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTrendingReposInput {
  language?: string
  since?: string
}

interface GetTrendingDevelopersInput {
  language?: string
  since?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gitterapp.com'
const USER_AGENT = 'settlegrid-github-trending/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`GitHub Trending API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'github-trending',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_trending_repos: { costCents: 1, displayName: 'Get trending repositories' },
      get_trending_developers: { costCents: 1, displayName: 'Get trending developers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTrendingRepos = sg.wrap(async (args: GetTrendingReposInput) => {

  const params: Record<string, string> = {}
  if (args.language !== undefined) params['language'] = String(args.language)
  if (args.since !== undefined) params['since'] = String(args.since)

  const data = await apiFetch<Record<string, unknown>>('/repositories', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 25) : [data]

  return { count: items.length, results: items }
}, { method: 'get_trending_repos' })

const getTrendingDevelopers = sg.wrap(async (args: GetTrendingDevelopersInput) => {

  const params: Record<string, string> = {}
  if (args.language !== undefined) params['language'] = String(args.language)
  if (args.since !== undefined) params['since'] = String(args.since)

  const data = await apiFetch<Record<string, unknown>>('/developers', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 25) : [data]

  return { count: items.length, results: items }
}, { method: 'get_trending_developers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTrendingRepos, getTrendingDevelopers }

console.log('settlegrid-github-trending MCP server ready')
console.log('Methods: get_trending_repos, get_trending_developers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
