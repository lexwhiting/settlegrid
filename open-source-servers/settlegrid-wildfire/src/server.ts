/**
 * settlegrid-wildfire — Wildfire Events MCP Server
 *
 * Active wildfire events from NASA EONET (Earth Observatory Natural Event Tracker).
 *
 * Methods:
 *   get_active_fires()            — Get currently active wildfire events  (1¢)
 *   get_fire_by_id(id)            — Get details for a specific fire event by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetActiveFiresInput {

}

interface GetFireByIdInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://eonet.gsfc.nasa.gov/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wildfire/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wildfire Events API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wildfire',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_active_fires: { costCents: 1, displayName: 'Active Fires' },
      get_fire_by_id: { costCents: 1, displayName: 'Get Fire' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getActiveFires = sg.wrap(async (args: GetActiveFiresInput) => {

  const data = await apiFetch<any>(`/events?category=wildfires&status=open&limit=20`)
  const items = (data.events ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        geometry: item.geometry,
        categories: item.categories,
        sources: item.sources,
    })),
  }
}, { method: 'get_active_fires' })

const getFireById = sg.wrap(async (args: GetFireByIdInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/events/${encodeURIComponent(id)}`)
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    geometry: data.geometry,
    categories: data.categories,
    sources: data.sources,
  }
}, { method: 'get_fire_by_id' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getActiveFires, getFireById }

console.log('settlegrid-wildfire MCP server ready')
console.log('Methods: get_active_fires, get_fire_by_id')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
