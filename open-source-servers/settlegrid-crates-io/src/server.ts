/**
 * settlegrid-crates-io — crates.io MCP Server
 *
 * Wraps the crates.io API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_crate(name)                          (1¢)
 *   search(q)                                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCrateInput {
  name: string
}

interface SearchInput {
  q: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://crates.io/api/v1'
const USER_AGENT = 'settlegrid-crates-io/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`crates.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'crates-io',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_crate: { costCents: 1, displayName: 'Get Rust crate information' },
      search: { costCents: 1, displayName: 'Search Rust crates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCrate = sg.wrap(async (args: GetCrateInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (crate name (e.g. serde, tokio))')
  }

  const params: Record<string, string> = {}
  params['name'] = String(args.name)

  const data = await apiFetch<Record<string, unknown>>(`/crates/${encodeURIComponent(String(args.name))}`, {
    params,
  })

  return data
}, { method: 'get_crate' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/crates', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCrate, search }

console.log('settlegrid-crates-io MCP server ready')
console.log('Methods: get_crate, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
