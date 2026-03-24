/**
 * settlegrid-advice-slip — Advice Slip MCP Server
 *
 * Wraps the Advice Slip API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_random()                             (1¢)
 *   search(query)                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.adviceslip.com'
const USER_AGENT = 'settlegrid-advice-slip/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Advice Slip API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'advice-slip',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Get random advice' },
      search: { costCents: 1, displayName: 'Search for advice by keyword' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/advice', {
    params,
  })

  return data
}, { method: 'get_random' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search keyword)')
  }

  const params: Record<string, string> = {}
  params['query'] = String(args.query)

  const data = await apiFetch<Record<string, unknown>>(`/advice/search/${encodeURIComponent(String(args.query))}`, {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, search }

console.log('settlegrid-advice-slip MCP server ready')
console.log('Methods: get_random, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
