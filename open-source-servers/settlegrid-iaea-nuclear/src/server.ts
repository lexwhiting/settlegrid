/**
 * settlegrid-iaea-nuclear — IAEA Nuclear Data MCP Server
 *
 * Wraps the IAEA PRIS API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_reactors(country?)       — List reactors (1\u00A2)
 *   get_reactor(id)               — Get reactor details (2\u00A2)
 *   get_power_stats(country)      — Get power stats (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListReactorsInput {
  country?: string
}

interface GetReactorInput {
  id: string
}

interface PowerStatsInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pris.iaea.org/PRIS/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-iaea-nuclear/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IAEA PRIS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'iaea-nuclear',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_reactors: { costCents: 1, displayName: 'List nuclear reactors' },
      get_reactor: { costCents: 2, displayName: 'Get reactor details' },
      get_power_stats: { costCents: 2, displayName: 'Get nuclear power statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listReactors = sg.wrap(async (args: ListReactorsInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  return apiFetch<unknown>('/reactors', params)
}, { method: 'list_reactors' })

const getReactor = sg.wrap(async (args: GetReactorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (reactor ID or name)')
  }
  return apiFetch<unknown>(`/reactors/${encodeURIComponent(args.id)}`)
}, { method: 'get_reactor' })

const getPowerStats = sg.wrap(async (args: PowerStatsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  return apiFetch<unknown>('/countrystatistics', { country: args.country })
}, { method: 'get_power_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listReactors, getReactor, getPowerStats }

console.log('settlegrid-iaea-nuclear MCP server ready')
console.log('Methods: list_reactors, get_reactor, get_power_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
