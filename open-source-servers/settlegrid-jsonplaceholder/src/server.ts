/**
 * settlegrid-jsonplaceholder — JSONPlaceholder MCP Server
 *
 * Wraps the JSONPlaceholder API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_posts()                              (1¢)
 *   get_users()                              (1¢)
 *   get_todos()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPostsInput {
  userId?: number
}

interface GetUsersInput {
}

interface GetTodosInput {
  userId?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://jsonplaceholder.typicode.com'
const USER_AGENT = 'settlegrid-jsonplaceholder/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`JSONPlaceholder API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'jsonplaceholder',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_posts: { costCents: 1, displayName: 'Get sample blog posts' },
      get_users: { costCents: 1, displayName: 'Get sample user data' },
      get_todos: { costCents: 1, displayName: 'Get sample todo items' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPosts = sg.wrap(async (args: GetPostsInput) => {

  const params: Record<string, string> = {}
  if (args.userId !== undefined) params['userId'] = String(args.userId)

  const data = await apiFetch<Record<string, unknown>>('/posts', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 20) : [data]

  return { count: items.length, results: items }
}, { method: 'get_posts' })

const getUsers = sg.wrap(async (args: GetUsersInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/users', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_users' })

const getTodos = sg.wrap(async (args: GetTodosInput) => {

  const params: Record<string, string> = {}
  if (args.userId !== undefined) params['userId'] = String(args.userId)

  const data = await apiFetch<Record<string, unknown>>('/todos', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 30) : [data]

  return { count: items.length, results: items }
}, { method: 'get_todos' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPosts, getUsers, getTodos }

console.log('settlegrid-jsonplaceholder MCP server ready')
console.log('Methods: get_posts, get_users, get_todos')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
