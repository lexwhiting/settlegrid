/**
 * settlegrid-congress — Congress API MCP Server
 *
 * Wraps the Congress API API with SettleGrid billing.
 * Requires CONGRESS_API_KEY environment variable.
 *
 * Methods:
 *   search_bills()                           (1¢)
 *   get_members()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBillsInput {
  offset?: number
  limit?: number
}

interface GetMembersInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.congress.gov/v3'
const USER_AGENT = 'settlegrid-congress/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.CONGRESS_API_KEY
  if (!key) throw new Error('CONGRESS_API_KEY environment variable is required')
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
  url.searchParams.set('api_key', getApiKey())
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
    throw new Error(`Congress API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'congress',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_bills: { costCents: 1, displayName: 'Search for bills in Congress' },
      get_members: { costCents: 1, displayName: 'Get current members of Congress' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBills = sg.wrap(async (args: SearchBillsInput) => {

  const params: Record<string, string> = {}
  if (args.offset !== undefined) params['offset'] = String(args.offset)
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/bill', {
    params,
  })

  return data
}, { method: 'search_bills' })

const getMembers = sg.wrap(async (args: GetMembersInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/member', {
    params,
  })

  return data
}, { method: 'get_members' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBills, getMembers }

console.log('settlegrid-congress MCP server ready')
console.log('Methods: search_bills, get_members')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
