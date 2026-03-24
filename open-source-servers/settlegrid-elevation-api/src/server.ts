/**
 * settlegrid-elevation-api — Elevation Data MCP Server
 *
 * Wraps Open-Meteo Elevation API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_elevation(lat, lon) — elevation for point (1¢)
 *   get_elevation_batch(points) — batch elevation (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ElevInput { lat: number; lon: number }
interface BatchInput { points: Array<{ lat: number; lon: number }> }

const API_BASE = 'https://api.open-meteo.com/v1/elevation'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'elevation-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_elevation: { costCents: 1, displayName: 'Get Elevation' },
      get_elevation_batch: { costCents: 2, displayName: 'Batch Elevation' },
    },
  },
})

const getElevation = sg.wrap(async (args: ElevInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}`)
  return { lat: args.lat, lon: args.lon, elevation_m: data.elevation?.[0], elevation_ft: data.elevation?.[0] ? Math.round(data.elevation[0] * 3.28084) : null }
}, { method: 'get_elevation' })

const getElevationBatch = sg.wrap(async (args: BatchInput) => {
  if (!args.points?.length) throw new Error('points array required')
  if (args.points.length > 100) throw new Error('Maximum 100 points')
  const lats = args.points.map(p => p.lat).join(',')
  const lons = args.points.map(p => p.lon).join(',')
  const data = await apiFetch<any>(`?latitude=${lats}&longitude=${lons}`)
  return {
    results: args.points.map((p, i) => ({
      lat: p.lat, lon: p.lon, elevation_m: data.elevation?.[i],
    })),
  }
}, { method: 'get_elevation_batch' })

export { getElevation, getElevationBatch }

console.log('settlegrid-elevation-api MCP server ready')
console.log('Methods: get_elevation, get_elevation_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
