/**
 * settlegrid-solar-system — Solar System Data MCP Server
 * Wraps Le Systeme Solaire API with SettleGrid billing.
 * Methods:
 *   list_bodies(filter?) — List bodies (1¢)
 *   get_body(id)         — Get body details (1¢)
 *   get_planets()        — Get all planets (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput {
  filter?: string
}

interface BodyInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.le-systeme-solaire.net/rest'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-solar-system/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Solar System API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'solar-system',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_bodies: { costCents: 1, displayName: 'List celestial bodies' },
      get_body: { costCents: 1, displayName: 'Get body details' },
      get_planets: { costCents: 1, displayName: 'Get all planets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listBodies = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.filter) {
    params['filter[]'] = `bodyType,eq,${args.filter}`
  }
  return apiFetch<unknown>('bodies', params)
}, { method: 'list_bodies' })

const getBody = sg.wrap(async (args: BodyInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "mars", "jupiter")')
  }
  return apiFetch<unknown>(`bodies/${encodeURIComponent(args.id)}`)
}, { method: 'get_body' })

const getPlanets = sg.wrap(async () => {
  return apiFetch<unknown>('bodies', { 'filter[]': 'isPlanet,eq,true' })
}, { method: 'get_planets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listBodies, getBody, getPlanets }

console.log('settlegrid-solar-system MCP server ready')
console.log('Methods: list_bodies, get_body, get_planets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
