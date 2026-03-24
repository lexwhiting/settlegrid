/**
 * settlegrid-ev-charging — Open Charge Map MCP Server
 *
 * Electric vehicle charging station locations worldwide.
 *
 * Methods:
 *   search_chargers(latitude, longitude, distance) — Search EV chargers near a lat/lng  (2¢)
 *   get_charger(id)               — Get details for a specific charging location  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchChargersInput {
  latitude: number
  longitude: number
  distance?: number
}

interface GetChargerInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openchargemap.io/v3'
const API_KEY = process.env.OPENCHARGEMAP_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ev-charging/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Charge Map API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ev-charging',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_chargers: { costCents: 2, displayName: 'Search Chargers' },
      get_charger: { costCents: 2, displayName: 'Charger Detail' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchChargers = sg.wrap(async (args: SearchChargersInput) => {
  if (typeof args.latitude !== 'number') throw new Error('latitude is required and must be a number')
  const latitude = args.latitude
  if (typeof args.longitude !== 'number') throw new Error('longitude is required and must be a number')
  const longitude = args.longitude
  const distance = typeof args.distance === 'number' ? args.distance : 0
  const data = await apiFetch<any>(`/poi?output=json&latitude=${latitude}&longitude=${longitude}&distance=${distance}&maxresults=10&key=${API_KEY}`)
  return {
    ID: data.ID,
    AddressInfo: data.AddressInfo,
    Connections: data.Connections,
    StatusType: data.StatusType,
    UsageCost: data.UsageCost,
  }
}, { method: 'search_chargers' })

const getCharger = sg.wrap(async (args: GetChargerInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/poi?output=json&chargepointid=${id}&key=${API_KEY}`)
  return {
    ID: data.ID,
    AddressInfo: data.AddressInfo,
    Connections: data.Connections,
    OperatorInfo: data.OperatorInfo,
    StatusType: data.StatusType,
    UsageCost: data.UsageCost,
  }
}, { method: 'get_charger' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchChargers, getCharger }

console.log('settlegrid-ev-charging MCP server ready')
console.log('Methods: search_chargers, get_charger')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
