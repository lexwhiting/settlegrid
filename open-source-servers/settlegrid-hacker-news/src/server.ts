/**
 * settlegrid-hacker-news — Hacker News MCP Server
 *
 * Wraps the Hacker News API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_top_stories()                        (1¢)
 *   get_item(id)                             (1¢)
 *   get_user(username)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTopStoriesInput {
}

interface GetItemInput {
  id: number
}

interface GetUserInput {
  username: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://hacker-news.firebaseio.com/v0'
const USER_AGENT = 'settlegrid-hacker-news/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Hacker News API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hacker-news',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_top_stories: { costCents: 1, displayName: 'Get IDs of current top stories' },
      get_item: { costCents: 1, displayName: 'Get a story, comment, or poll by ID' },
      get_user: { costCents: 1, displayName: 'Get user profile' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTopStories = sg.wrap(async (args: GetTopStoriesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/topstories.json', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 30) : [data]

  return { count: items.length, results: items }
}, { method: 'get_top_stories' })

const getItem = sg.wrap(async (args: GetItemInput) => {
  if (typeof args.id !== 'number' || isNaN(args.id)) {
    throw new Error('id must be a number')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/item/${encodeURIComponent(String(args.id))}.json`, {
    params,
  })

  return data
}, { method: 'get_item' })

const getUser = sg.wrap(async (args: GetUserInput) => {
  if (!args.username || typeof args.username !== 'string') {
    throw new Error('username is required (hn username)')
  }

  const params: Record<string, string> = {}
  params['username'] = String(args.username)

  const data = await apiFetch<Record<string, unknown>>(`/user/${encodeURIComponent(String(args.username))}.json`, {
    params,
  })

  return data
}, { method: 'get_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTopStories, getItem, getUser }

console.log('settlegrid-hacker-news MCP server ready')
console.log('Methods: get_top_stories, get_item, get_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
