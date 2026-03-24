/**
 * settlegrid-bluesky — Bluesky Posts & Profiles MCP Server
 *
 * Wraps the Bluesky AT Protocol public API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_profile(handle)              — Get user profile   (1¢)
 *   get_author_feed(handle, limit)   — Get user's posts   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileInput {
  handle: string
}

interface FeedInput {
  handle: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'

async function bskyFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BSKY_BASE}${path}`)
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
      get_profile: { costCents: 1, displayName: 'Get Profile' },
      get_author_feed: { costCents: 1, displayName: 'Get Author Feed' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: ProfileInput) => {
  if (!args.handle || typeof args.handle !== 'string') {
    throw new Error('handle is required (e.g. "user.bsky.social")')
  }
  const h = encodeURIComponent(args.handle.trim())
  const data = await bskyFetch<any>(`/app.bsky.actor.getProfile?actor=${h}`)
  return {
    did: data.did,
    handle: data.handle,
    displayName: data.displayName,
    description: data.description?.slice(0, 500),
    followersCount: data.followersCount,
    followsCount: data.followsCount,
    postsCount: data.postsCount,
    avatar: data.avatar,
    createdAt: data.createdAt,
  }
}, { method: 'get_profile' })

const getAuthorFeed = sg.wrap(async (args: FeedInput) => {
  if (!args.handle || typeof args.handle !== 'string') {
    throw new Error('handle is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const h = encodeURIComponent(args.handle.trim())
  const data = await bskyFetch<{ feed: any[] }>(
    `/app.bsky.feed.getAuthorFeed?actor=${h}&limit=${limit}`
  )
  return {
    handle: args.handle,
    count: data.feed.length,
    posts: data.feed.map((item: any) => ({
      uri: item.post?.uri,
      text: item.post?.record?.text?.slice(0, 500),
      createdAt: item.post?.record?.createdAt,
      likeCount: item.post?.likeCount,
      repostCount: item.post?.repostCount,
      replyCount: item.post?.replyCount,
    })),
  }
}, { method: 'get_author_feed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getAuthorFeed }

console.log('settlegrid-bluesky MCP server ready')
console.log('Methods: get_profile, get_author_feed')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
