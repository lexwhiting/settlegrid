/**
 * settlegrid-rest-countries — REST Countries MCP Server
 *
 * Wraps the REST Countries API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_all()                                (1¢)
 *   get_by_name(name)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAllInput {
  fields?: string
}

interface GetByNameInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const USER_AGENT = 'settlegrid-rest-countries/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`REST Countries API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rest-countries',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_all: { costCents: 1, displayName: 'Get data for all countries' },
      get_by_name: { costCents: 1, displayName: 'Get country by name' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAll = sg.wrap(async (args: GetAllInput) => {

  const params: Record<string, string> = {}
  if (args.fields !== undefined) params['fields'] = String(args.fields)

  const data = await apiFetch<Record<string, unknown>>('/all', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_all' })

const getByName = sg.wrap(async (args: GetByNameInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (country name)')
  }

  const params: Record<string, string> = {}
  params['name'] = String(args.name)

  const data = await apiFetch<Record<string, unknown>>(`/name/${encodeURIComponent(String(args.name))}`, {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 5) : [data]

  return { name: args.name, count: items.length, results: items }
}, { method: 'get_by_name' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAll, getByName }

console.log('settlegrid-rest-countries MCP server ready')
console.log('Methods: get_all, get_by_name')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
