/**
 * settlegrid-open-meteo-geocoding — Open-Meteo Geocoding MCP Server
 *
 * Wraps the Open-Meteo Geocoding API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(name)                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  name: string
  count?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://geocoding-api.open-meteo.com/v1'
const USER_AGENT = 'settlegrid-open-meteo-geocoding/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Open-Meteo Geocoding API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-meteo-geocoding',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search for locations by name' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (city or location name)')
  }

  const params: Record<string, string> = {}
  params['name'] = args.name
  if (args.count !== undefined) params['count'] = String(args.count)

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search }

console.log('settlegrid-open-meteo-geocoding MCP server ready')
console.log('Methods: search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
