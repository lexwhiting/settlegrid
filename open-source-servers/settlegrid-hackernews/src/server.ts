/**
 * settlegrid-hackernews — Hacker News MCP Server
 *
 * Wraps the HN Firebase API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_top_stories(limit)   — Top stories      (1¢)
 *   get_item(id)             — Story/comment    (1¢)
 *   get_user(username)       — User profile     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopStoriesInput {
  limit?: number
}

interface ItemInput {
  id: number
}

interface UserInput {
  username: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'

async function hnFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${HN_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HN API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hackernews',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_top_stories: { costCents: 1, displayName: 'Top Stories' },
      get_item: { costCents: 1, displayName: 'Get Item' },
      get_user: { costCents: 1, displayName: 'Get User' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTopStories = sg.wrap(async (args: TopStoriesInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 30)
  const ids = await hnFetch<number[]>('/topstories.json')
  const topIds = ids.slice(0, limit)
  const stories = await Promise.all(
    topIds.map((id) => hnFetch<any>(`/item/${id}.json`))
  )
  return {
    count: stories.length,
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url || null,
      score: s.score,
      by: s.by,
      time: new Date(s.time * 1000).toISOString(),
      descendants: s.descendants || 0,
      type: s.type,
    })),
  }
}, { method: 'get_top_stories' })

const getItem = sg.wrap(async (args: ItemInput) => {
  if (typeof args.id !== 'number' || !Number.isFinite(args.id)) {
    throw new Error('id must be a number')
  }
  const item = await hnFetch<any>(`/item/${args.id}.json`)
  if (!item) throw new Error(`Item not found: ${args.id}`)
  return {
    id: item.id,
    type: item.type,
    title: item.title || null,
    text: item.text?.slice(0, 1000) || null,
    url: item.url || null,
    score: item.score || 0,
    by: item.by,
    time: new Date(item.time * 1000).toISOString(),
    kids: item.kids?.slice(0, 10) || [],
  }
}, { method: 'get_item' })

const getUser = sg.wrap(async (args: UserInput) => {
  if (!args.username || typeof args.username !== 'string') {
    throw new Error('username is required')
  }
  const user = await hnFetch<any>(`/user/${encodeURIComponent(args.username)}.json`)
  if (!user) throw new Error(`User not found: ${args.username}`)
  return {
    id: user.id,
    karma: user.karma,
    about: user.about?.slice(0, 500) || null,
    created: new Date(user.created * 1000).toISOString(),
    submitted: user.submitted?.length || 0,
  }
}, { method: 'get_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTopStories, getItem, getUser }

console.log('settlegrid-hackernews MCP server ready')
console.log('Methods: get_top_stories, get_item, get_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
