/**
 * settlegrid-submarine-cables — Submarine Cable Data MCP Server
 *
 * Wraps TeleGeography Submarine Cable Map API with SettleGrid billing.
 * No API key needed — the API is free and public.
 *
 * Methods:
 *   list_cables(limit?) — List cables (1¢)
 *   get_cable(id) — Cable details (1¢)
 *   list_landing_points(country?) — Landing points (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput { limit?: number }
interface CableInput { id: string }
interface LandingInput { country?: string }

interface Cable {
  id: string
  name: string
  color: string
  length: string
  rfs: string
  owners: string
  url: string
  is_planned: boolean
}

interface LandingPoint {
  id: string
  name: string
  country: string
  latitude: number
  longitude: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.submarinecablemap.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'submarine-cables',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_cables: { costCents: 1, displayName: 'List Cables' },
      get_cable: { costCents: 1, displayName: 'Cable Details' },
      list_landing_points: { costCents: 1, displayName: 'Landing Points' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCables = sg.wrap(async (args: ListInput) => {
  const limit = args.limit ?? 25
  if (limit < 1 || limit > 500) throw new Error('limit must be 1-500')
  const cables = await apiFetch<Cable[]>('/cable/all.json')
  const sorted = cables.sort((a, b) => {
    const ya = parseInt(a.rfs) || 0
    const yb = parseInt(b.rfs) || 0
    return yb - ya
  })
  return {
    cables: sorted.slice(0, limit).map(c => ({
      id: c.id,
      name: c.name,
      length: c.length,
      ready_for_service: c.rfs,
      owners: c.owners,
      is_planned: c.is_planned,
    })),
    total: cables.length,
    returned: Math.min(limit, cables.length),
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'list_cables' })

const getCable = sg.wrap(async (args: CableInput) => {
  if (!args.id) throw new Error('id is required')
  const cable = await apiFetch<any>(`/cable/${args.id}.json`)
  return {
    cable: {
      id: cable.id,
      name: cable.name,
      color: cable.color,
      length: cable.length,
      ready_for_service: cable.rfs,
      owners: cable.owners,
      url: cable.url,
      is_planned: cable.is_planned,
      landing_points: cable.landing_points,
    },
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'get_cable' })

const listLandingPoints = sg.wrap(async (args: LandingInput) => {
  const points = await apiFetch<LandingPoint[]>('/landing-point/all.json')
  let filtered = points
  if (args.country) {
    const country = args.country.toLowerCase()
    filtered = points.filter(p => p.country?.toLowerCase().includes(country))
  }
  return {
    landing_points: filtered.slice(0, 100).map(p => ({
      id: p.id,
      name: p.name,
      country: p.country,
      lat: p.latitude,
      lon: p.longitude,
    })),
    total: filtered.length,
    filter: args.country || 'all',
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'list_landing_points' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCables, getCable, listLandingPoints }

console.log('settlegrid-submarine-cables MCP server ready')
console.log('Methods: list_cables, get_cable, list_landing_points')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
