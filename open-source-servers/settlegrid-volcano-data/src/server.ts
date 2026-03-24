/**
 * settlegrid-volcano-data — Volcanic Activity Data MCP Server
 * Wraps USGS Volcano Hazards API with SettleGrid billing.
 * Methods:
 *   list_volcanoes(country?, status?) — List volcanoes (1¢)
 *   get_volcano(id)                   — Get volcano details (1¢)
 *   get_recent_eruptions(limit?)      — Get recent eruptions (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput {
  country?: string
  status?: string
}

interface VolcanoInput {
  id: string
}

interface RecentInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://volcanoes.usgs.gov/vsc/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-volcano-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Volcano API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'volcano-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_volcanoes: { costCents: 1, displayName: 'List volcanoes' },
      get_volcano: { costCents: 1, displayName: 'Get volcano details' },
      get_recent_eruptions: { costCents: 2, displayName: 'Get recent eruptions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listVolcanoes = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.status) params.status = args.status
  return apiFetch<unknown>('volcanoApi/volcanos', params)
}, { method: 'list_volcanoes' })

const getVolcano = sg.wrap(async (args: VolcanoInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (volcano number or name)')
  }
  return apiFetch<unknown>(`volcanoApi/volcanos/${encodeURIComponent(args.id)}`)
}, { method: 'get_volcano' })

const getRecentEruptions = sg.wrap(async (args: RecentInput) => {
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('volcanoApi/volcanos', {
    status: 'Historical',
    limit: String(limit),
  })
}, { method: 'get_recent_eruptions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listVolcanoes, getVolcano, getRecentEruptions }

console.log('settlegrid-volcano-data MCP server ready')
console.log('Methods: list_volcanoes, get_volcano, get_recent_eruptions')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
