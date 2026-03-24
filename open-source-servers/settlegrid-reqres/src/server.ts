/**
 * settlegrid-reqres — ReqRes MCP Server
 *
 * Wraps the ReqRes API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_users()                             (1¢)
 *   get_user(id)                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListUsersInput {
  page?: number
}

interface GetUserInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://reqres.in/api'
const USER_AGENT = 'settlegrid-reqres/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`ReqRes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'reqres',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_users: { costCents: 1, displayName: 'List users with pagination' },
      get_user: { costCents: 1, displayName: 'Get a single user by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listUsers = sg.wrap(async (args: ListUsersInput) => {

  const params: Record<string, string> = {}
  if (args.page !== undefined) params['page'] = String(args.page)

  const data = await apiFetch<Record<string, unknown>>('/users', {
    params,
  })

  return data
}, { method: 'list_users' })

const getUser = sg.wrap(async (args: GetUserInput) => {
  if (typeof args.id !== 'number' || isNaN(args.id)) {
    throw new Error('id must be a number')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/users/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listUsers, getUser }

console.log('settlegrid-reqres MCP server ready')
console.log('Methods: list_users, get_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
