/**
 * settlegrid-bluesky — Bluesky MCP Server
 *
 * Wraps the Bluesky API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_profile(actor)                       (1¢)
 *   get_feed(actor)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetProfileInput {
  actor: string
}

interface GetFeedInput {
  actor: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://public.api.bsky.app/xrpc'
const USER_AGENT = 'settlegrid-bluesky/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Bluesky API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bluesky',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_profile: { costCents: 1, displayName: 'Get a user profile' },
      get_feed: { costCents: 1, displayName: 'Get a user's post feed' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: GetProfileInput) => {
  if (!args.actor || typeof args.actor !== 'string') {
    throw new Error('actor is required (handle or did (e.g. user.bsky.social))')
  }

  const params: Record<string, string> = {}
  params['actor'] = args.actor

  const data = await apiFetch<Record<string, unknown>>('/app.bsky.actor.getProfile', {
    params,
  })

  return data
}, { method: 'get_profile' })

const getFeed = sg.wrap(async (args: GetFeedInput) => {
  if (!args.actor || typeof args.actor !== 'string') {
    throw new Error('actor is required (handle or did)')
  }

  const params: Record<string, string> = {}
  params['actor'] = args.actor
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/app.bsky.feed.getAuthorFeed', {
    params,
  })

  return data
}, { method: 'get_feed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getFeed }

console.log('settlegrid-bluesky MCP server ready')
console.log('Methods: get_profile, get_feed')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
