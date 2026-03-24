/**
 * settlegrid-transit-land — Transitland MCP Server
 *
 * Public transit data — routes, stops, and operators worldwide.
 *
 * Methods:
 *   search_operators(name)        — Search transit operators by name  (1¢)
 *   search_stops(name)            — Search transit stops by name  (1¢)
 *   search_routes(name)           — Search transit routes by name or operator  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchOperatorsInput {
  name: string
}

interface SearchStopsInput {
  name: string
}

interface SearchRoutesInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://transit.land/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-transit-land/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Transitland API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'transit-land',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_operators: { costCents: 1, displayName: 'Search Operators' },
      search_stops: { costCents: 1, displayName: 'Search Stops' },
      search_routes: { costCents: 1, displayName: 'Search Routes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchOperators = sg.wrap(async (args: SearchOperatorsInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  const data = await apiFetch<any>(`/rest/operators?search=${encodeURIComponent(name)}`)
  const items = (data.operators ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        onestop_id: item.onestop_id,
        name: item.name,
        short_name: item.short_name,
        website: item.website,
    })),
  }
}, { method: 'search_operators' })

const searchStops = sg.wrap(async (args: SearchStopsInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  const data = await apiFetch<any>(`/rest/stops?search=${encodeURIComponent(name)}`)
  const items = (data.stops ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        onestop_id: item.onestop_id,
        stop_name: item.stop_name,
        geometry: item.geometry,
    })),
  }
}, { method: 'search_stops' })

const searchRoutes = sg.wrap(async (args: SearchRoutesInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  const data = await apiFetch<any>(`/rest/routes?search=${encodeURIComponent(name)}`)
  const items = (data.routes ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        onestop_id: item.onestop_id,
        route_short_name: item.route_short_name,
        route_long_name: item.route_long_name,
        route_type: item.route_type,
    })),
  }
}, { method: 'search_routes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchOperators, searchStops, searchRoutes }

console.log('settlegrid-transit-land MCP server ready')
console.log('Methods: search_operators, search_stops, search_routes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
