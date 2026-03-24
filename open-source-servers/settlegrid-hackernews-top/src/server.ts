/**
 * settlegrid-hackernews-top — Hacker News Top Stories MCP Server
 *
 * Wraps HN Firebase API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_top_stories(limit?) — top stories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TopInput { limit?: number }

const API_BASE = 'https://hacker-news.firebaseio.com/v0'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'hackernews-top',
  pricing: { defaultCostCents: 1, methods: { get_top_stories: { costCents: 1, displayName: 'Top Stories' } } },
})

const getTopStories = sg.wrap(async (args: TopInput) => {
  const limit = args.limit ?? 10
  const ids = await apiFetch<number[]>('/topstories.json')
  const top = ids.slice(0, limit)
  const stories = await Promise.all(top.map(id => apiFetch<any>(`/item/${id}.json`)))
  return {
    stories: stories.map(s => ({
      id: s.id, title: s.title, url: s.url, by: s.by,
      score: s.score, comments: s.descendants, time: s.time,
    })),
  }
}, { method: 'get_top_stories' })

export { getTopStories }

console.log('settlegrid-hackernews-top MCP server ready')
console.log('Methods: get_top_stories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
