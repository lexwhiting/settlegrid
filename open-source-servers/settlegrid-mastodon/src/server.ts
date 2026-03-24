/**
 * settlegrid-mastodon — Mastodon Public Timeline MCP Server
 *
 * Wraps the Mastodon API (mastodon.social) with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_public_timeline(limit)   — Public timeline    (1¢)
 *   search(query, type)          — Search Mastodon    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimelineInput {
  limit?: number
}

interface SearchInput {
  query: string
  type?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MASTO_BASE = 'https://mastodon.social/api'

async function mastoFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${MASTO_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mastodon API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 500)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mastodon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_public_timeline: { costCents: 1, displayName: 'Public Timeline' },
      search: { costCents: 1, displayName: 'Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPublicTimeline = sg.wrap(async (args: TimelineInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await mastoFetch<any[]>(`/v1/timelines/public?limit=${limit}`)
  return {
    count: data.length,
    statuses: data.map((s: any) => ({
      id: s.id,
      content: stripHtml(s.content),
      account: s.account?.acct,
      displayName: s.account?.display_name,
      createdAt: s.created_at,
      favourites: s.favourites_count,
      reblogs: s.reblogs_count,
      replies: s.replies_count,
      language: s.language,
    })),
  }
}, { method: 'get_public_timeline' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  let url = `/v2/search?q=${q}&limit=10`
  if (args.type && ['accounts', 'hashtags', 'statuses'].includes(args.type)) {
    url += `&type=${args.type}`
  }
  const data = await mastoFetch<{ accounts: any[]; statuses: any[]; hashtags: any[] }>(url)
  return {
    query: args.query,
    accounts: data.accounts?.slice(0, 5).map((a: any) => ({
      id: a.id, acct: a.acct, displayName: a.display_name, followersCount: a.followers_count,
    })) || [],
    statuses: data.statuses?.slice(0, 5).map((s: any) => ({
      id: s.id, content: stripHtml(s.content), account: s.account?.acct, createdAt: s.created_at,
    })) || [],
    hashtags: data.hashtags?.slice(0, 5).map((h: any) => ({
      name: h.name, url: h.url,
    })) || [],
  }
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPublicTimeline, search }

console.log('settlegrid-mastodon MCP server ready')
console.log('Methods: get_public_timeline, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
