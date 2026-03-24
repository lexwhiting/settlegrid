/**
 * settlegrid-traffic — TomTom Traffic MCP Server
 *
 * Real-time traffic flow and incidents from TomTom.
 *
 * Methods:
 *   get_flow(latitude, longitude) — Get traffic flow data for a road segment  (2¢)
 *   get_incidents(minLat, minLon, maxLat, maxLon) — Get traffic incidents in a bounding box  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFlowInput {
  latitude: number
  longitude: number
}

interface GetIncidentsInput {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tomtom.com/traffic'
const API_KEY = process.env.TOMTOM_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-traffic/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TomTom Traffic API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'traffic',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_flow: { costCents: 2, displayName: 'Traffic Flow' },
      get_incidents: { costCents: 2, displayName: 'Traffic Incidents' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlow = sg.wrap(async (args: GetFlowInput) => {
  if (typeof args.latitude !== 'number') throw new Error('latitude is required and must be a number')
  const latitude = args.latitude
  if (typeof args.longitude !== 'number') throw new Error('longitude is required and must be a number')
  const longitude = args.longitude
  const data = await apiFetch<any>(`/services/4/flowSegmentData/absolute/10/json?point=${latitude},${longitude}&key=${API_KEY}`)
  return {
    flowSegmentData: data.flowSegmentData,
  }
}, { method: 'get_flow' })

const getIncidents = sg.wrap(async (args: GetIncidentsInput) => {
  if (typeof args.minLat !== 'number') throw new Error('minLat is required and must be a number')
  const minLat = args.minLat
  if (typeof args.minLon !== 'number') throw new Error('minLon is required and must be a number')
  const minLon = args.minLon
  if (typeof args.maxLat !== 'number') throw new Error('maxLat is required and must be a number')
  const maxLat = args.maxLat
  if (typeof args.maxLon !== 'number') throw new Error('maxLon is required and must be a number')
  const maxLon = args.maxLon
  const data = await apiFetch<any>(`/services/5/incidentDetails?bbox=${minLon},${minLat},${maxLon},${maxLat}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},startTime,endTime}}}&language=en-US&key=${API_KEY}`)
  const items = (data.incidents ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        type: item.type,
        geometry: item.geometry,
        properties: item.properties,
    })),
  }
}, { method: 'get_incidents' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlow, getIncidents }

console.log('settlegrid-traffic MCP server ready')
console.log('Methods: get_flow, get_incidents')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
