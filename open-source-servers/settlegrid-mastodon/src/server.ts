/**
 * settlegrid-mastodon — Mastodon MCP Server
 *
 * Wraps the Mastodon API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_public_timeline()                    (1¢)
 *   search(q)                                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPublicTimelineInput {
  limit?: number
}

interface SearchInput {
  q: string
  type?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://mastodon.social/api/v1'
const USER_AGENT = 'settlegrid-mastodon/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Mastodon API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mastodon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_public_timeline: { costCents: 1, displayName: 'Get public timeline posts' },
      search: { costCents: 1, displayName: 'Search for accounts, statuses, or hashtags' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPublicTimeline = sg.wrap(async (args: GetPublicTimelineInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/timelines/public', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_public_timeline' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.type !== undefined) params['type'] = String(args.type)

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPublicTimeline, search }

console.log('settlegrid-mastodon MCP server ready')
console.log('Methods: get_public_timeline, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
