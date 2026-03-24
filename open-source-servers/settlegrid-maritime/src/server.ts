/**
 * settlegrid-maritime — Maritime AIS MCP Server
 *
 * Live vessel tracking and AIS data from Digitraffic maritime API.
 *
 * Methods:
 *   get_vessels()                 — Get latest AIS positions for all vessels  (1¢)
 *   get_vessel(mmsi)              — Get AIS data for a specific vessel by MMSI number  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetVesselsInput {

}

interface GetVesselInput {
  mmsi: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://meri.digitraffic.fi/api/ais/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-maritime/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Maritime AIS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'maritime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_vessels: { costCents: 1, displayName: 'All Vessels' },
      get_vessel: { costCents: 1, displayName: 'Vessel by MMSI' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getVessels = sg.wrap(async (args: GetVesselsInput) => {

  const data = await apiFetch<any>(`/locations`)
  const items = (data.features ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        mmsi: item.mmsi,
        properties: item.properties,
        geometry: item.geometry,
    })),
  }
}, { method: 'get_vessels' })

const getVessel = sg.wrap(async (args: GetVesselInput) => {
  if (typeof args.mmsi !== 'number') throw new Error('mmsi is required and must be a number')
  const mmsi = args.mmsi
  const data = await apiFetch<any>(`/locations/${mmsi}`)
  return {
    mmsi: data.mmsi,
    name: data.name,
    shipType: data.shipType,
    destination: data.destination,
    geometry: data.geometry,
  }
}, { method: 'get_vessel' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getVessels, getVessel }

console.log('settlegrid-maritime MCP server ready')
console.log('Methods: get_vessels, get_vessel')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
