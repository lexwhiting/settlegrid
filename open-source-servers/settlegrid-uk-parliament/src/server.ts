/**
 * settlegrid-uk-parliament — UK Parliament MCP Server
 *
 * Wraps the UK Parliament API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_members(Name)                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMembersInput {
  Name: string
  take?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://members-api.parliament.uk/api'
const USER_AGENT = 'settlegrid-uk-parliament/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`UK Parliament API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-parliament',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_members: { costCents: 1, displayName: 'Search for members of Parliament' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMembers = sg.wrap(async (args: SearchMembersInput) => {
  if (!args.Name || typeof args.Name !== 'string') {
    throw new Error('Name is required (member name to search)')
  }

  const params: Record<string, string> = {}
  params['Name'] = args.Name
  if (args.take !== undefined) params['take'] = String(args.take)

  const data = await apiFetch<Record<string, unknown>>('/Members/Search', {
    params,
  })

  return data
}, { method: 'search_members' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMembers }

console.log('settlegrid-uk-parliament MCP server ready')
console.log('Methods: search_members')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
