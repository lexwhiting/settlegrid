/**
 * settlegrid-asteroid-data — Asteroid Tracking MCP Server
 * Wraps NASA NeoWs API with SettleGrid billing.
 * Methods:
 *   get_feed(startDate, endDate?) — Get NEO feed (2¢)
 *   get_asteroid(id)              — Get asteroid details (1¢)
 *   get_stats()                   — Get statistics (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeedInput {
  startDate: string
  endDate?: string
}

interface AsteroidInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov/neo/rest/v1'
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('api_key', API_KEY)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-asteroid-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NASA NeoWs ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'asteroid-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_feed: { costCents: 2, displayName: 'Get NEO feed' },
      get_asteroid: { costCents: 1, displayName: 'Get asteroid details' },
      get_stats: { costCents: 1, displayName: 'Get NeoWs statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeed = sg.wrap(async (args: FeedInput) => {
  if (!args.startDate || typeof args.startDate !== 'string') {
    throw new Error('startDate is required (YYYY-MM-DD)')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
    throw new Error('startDate must be in YYYY-MM-DD format')
  }
  const params: Record<string, string> = { start_date: args.startDate }
  if (args.endDate) params.end_date = args.endDate
  return apiFetch<unknown>('feed', params)
}, { method: 'get_feed' })

const getAsteroid = sg.wrap(async (args: AsteroidInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NASA SPK-ID)')
  }
  return apiFetch<unknown>(`neo/${encodeURIComponent(args.id)}`)
}, { method: 'get_asteroid' })

const getStats = sg.wrap(async () => {
  return apiFetch<unknown>('stats')
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeed, getAsteroid, getStats }

console.log('settlegrid-asteroid-data MCP server ready')
console.log('Methods: get_feed, get_asteroid, get_stats')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
