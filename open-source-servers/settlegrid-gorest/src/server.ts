/**
 * settlegrid-gorest — GoRest MCP Server
 *
 * Wraps the GoRest API with SettleGrid billing.
 * Requires GOREST_TOKEN environment variable.
 *
 * Methods:
 *   get_users()                              (1¢)
 *   get_posts()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetUsersInput {
  page?: number
}

interface GetPostsInput {
  page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gorest.co.in/public/v2'
const USER_AGENT = 'settlegrid-gorest/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GOREST_TOKEN
  if (!key) throw new Error('GOREST_TOKEN environment variable is required')
  return key
}

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
    Authorization: `Bearer ${getApiKey()}`,
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
    throw new Error(`GoRest API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gorest',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_users: { costCents: 1, displayName: 'Get list of users' },
      get_posts: { costCents: 1, displayName: 'Get list of posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getUsers = sg.wrap(async (args: GetUsersInput) => {

  const params: Record<string, string> = {}
  if (args.page !== undefined) params['page'] = String(args.page)

  const data = await apiFetch<Record<string, unknown>>('/users', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 20) : [data]

  return { count: items.length, results: items }
}, { method: 'get_users' })

const getPosts = sg.wrap(async (args: GetPostsInput) => {

  const params: Record<string, string> = {}
  if (args.page !== undefined) params['page'] = String(args.page)

  const data = await apiFetch<Record<string, unknown>>('/posts', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 20) : [data]

  return { count: items.length, results: items }
}, { method: 'get_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getUsers, getPosts }

console.log('settlegrid-gorest MCP server ready')
console.log('Methods: get_users, get_posts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
