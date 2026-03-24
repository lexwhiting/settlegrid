/**
 * settlegrid-lobsters — Lobste.rs Tech Stories MCP Server
 *
 * Wraps the Lobste.rs JSON API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_hottest()  — Hottest stories  (1¢)
 *   get_newest()   — Newest stories   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const LOBSTERS_BASE = 'https://lobste.rs'

async function lobstersFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${LOBSTERS_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Lobste.rs API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatStory(s: any): Record<string, unknown> {
  return {
    shortId: s.short_id,
    title: s.title,
    url: s.url,
    score: s.score,
    commentCount: s.comment_count,
    tags: s.tags,
    submitter: s.submitter_user?.username || s.submitter_user,
    createdAt: s.created_at,
    commentsUrl: s.comments_url,
    description: s.description?.slice(0, 300) || '',
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lobsters',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hottest: { costCents: 1, displayName: 'Hottest Stories' },
      get_newest: { costCents: 1, displayName: 'Newest Stories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHottest = sg.wrap(async () => {
  const data = await lobstersFetch<any[]>('/hottest.json')
  return {
    count: data.length,
    stories: data.slice(0, 25).map(formatStory),
  }
}, { method: 'get_hottest' })

const getNewest = sg.wrap(async () => {
  const data = await lobstersFetch<any[]>('/newest.json')
  return {
    count: data.length,
    stories: data.slice(0, 25).map(formatStory),
  }
}, { method: 'get_newest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHottest, getNewest }

console.log('settlegrid-lobsters MCP server ready')
console.log('Methods: get_hottest, get_newest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
