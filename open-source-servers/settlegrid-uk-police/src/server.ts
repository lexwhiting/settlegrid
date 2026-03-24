/**
 * settlegrid-uk-police — UK Crime Data MCP Server
 *
 * Wraps UK Police Data API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_crimes(lat, lon, date?)            — Get street-level crimes (1¢)
 *   get_forces()                           — List police forces (1¢)
 *   get_neighbourhood(force, id)           — Get neighbourhood details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCrimesInput {
  lat: number
  lon: number
  date?: string
}

interface GetForcesInput {}

interface GetNeighbourhoodInput {
  force: string
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.police.uk/api'
const USER_AGENT = 'settlegrid-uk-police/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UK Police API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-police',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_crimes: { costCents: 1, displayName: 'Get street-level crimes' },
      get_forces: { costCents: 1, displayName: 'List police forces' },
      get_neighbourhood: { costCents: 1, displayName: 'Get neighbourhood details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCrimes = sg.wrap(async (args: GetCrimesInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const params: Record<string, string> = {
    lat: String(args.lat),
    lng: String(args.lon),
  }
  if (args.date) params['date'] = args.date
  const data = await apiFetch<unknown[]>('/crimes-street/all-crime', { params })
  return { count: Array.isArray(data) ? data.length : 0, crimes: data }
}, { method: 'get_crimes' })

const getForces = sg.wrap(async (_args: GetForcesInput) => {
  const data = await apiFetch<unknown[]>('/forces')
  return { count: Array.isArray(data) ? data.length : 0, forces: data }
}, { method: 'get_forces' })

const getNeighbourhood = sg.wrap(async (args: GetNeighbourhoodInput) => {
  if (!args.force || typeof args.force !== 'string') {
    throw new Error('force is required (force slug)')
  }
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (neighbourhood ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(args.force)}/${encodeURIComponent(args.id)}`)
  return data
}, { method: 'get_neighbourhood' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCrimes, getForces, getNeighbourhood }

console.log('settlegrid-uk-police MCP server ready')
console.log('Methods: get_crimes, get_forces, get_neighbourhood')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
