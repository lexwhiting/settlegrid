/**
 * settlegrid-usgs-earthquakes — USGS Earthquake Data MCP Server
 *
 * Wraps the USGS Earthquake Hazards API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_recent_earthquakes(min_magnitude, limit)  — Recent quakes    (1¢)
 *   get_earthquake(event_id)                      — Quake details    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentInput {
  min_magnitude?: number
  limit?: number
}

interface EventInput {
  event_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1'

async function usgsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${USGS_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USGS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatQuake(f: any): Record<string, unknown> {
  return {
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toISOString(),
    tsunami: f.properties.tsunami === 1,
    type: f.properties.type,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    depth: f.geometry.coordinates[2],
    url: f.properties.url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usgs-earthquakes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recent_earthquakes: { costCents: 1, displayName: 'Recent Earthquakes' },
      get_earthquake: { costCents: 1, displayName: 'Get Earthquake' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecentEarthquakes = sg.wrap(async (args: RecentInput) => {
  const minMag = Math.max(args.min_magnitude ?? 4.5, 0)
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await usgsFetch<{ features: any[]; metadata: { count: number } }>(
    `/query?format=geojson&minmagnitude=${minMag}&limit=${limit}&orderby=time`
  )
  return {
    count: data.features.length,
    minMagnitude: minMag,
    earthquakes: data.features.map(formatQuake),
  }
}, { method: 'get_recent_earthquakes' })

const getEarthquake = sg.wrap(async (args: EventInput) => {
  if (!args.event_id || typeof args.event_id !== 'string') {
    throw new Error('event_id is required')
  }
  const data = await usgsFetch<any>(
    `/query?format=geojson&eventid=${encodeURIComponent(args.event_id)}`
  )
  if (!data.features?.length) {
    throw new Error(`Earthquake not found: ${args.event_id}`)
  }
  return formatQuake(data.features[0])
}, { method: 'get_earthquake' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecentEarthquakes, getEarthquake }

console.log('settlegrid-usgs-earthquakes MCP server ready')
console.log('Methods: get_recent_earthquakes, get_earthquake')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
