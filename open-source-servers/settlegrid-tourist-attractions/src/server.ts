/**
 * settlegrid-tourist-attractions — Tourist Attractions MCP Server
 *
 * Provides top tourist attractions by city using OpenTripMap.
 * No API key needed for basic access.
 *
 * Methods:
 *   get_attractions(city, limit)       (2¢)
 *   get_attraction_detail(xid)         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetAttractionsInput { city: string; limit?: number }
interface GetAttractionDetailInput { xid: string }

const API_BASE = 'https://api.opentripmap.com/0.1/en/places'
const USER_AGENT = 'settlegrid-tourist-attractions/1.0 (contact@settlegrid.ai)'
const API_KEY = process.env.OPENTRIPMAP_API_KEY || '5ae2e3f221c38a28845f05b6aff4c44ec7ef3a0b3883cd4c0afc9e48'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('apikey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenTripMap API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'tourist-attractions',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_attractions: { costCents: 2, displayName: 'Get attractions by city' },
      get_attraction_detail: { costCents: 1, displayName: 'Get attraction details' },
    },
  },
})

const getAttractions = sg.wrap(async (args: GetAttractionsInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const geo = await apiFetch<Record<string, unknown>>('/geoname', { name: args.city })
  const lat = (geo as Record<string, number>).lat
  const lon = (geo as Record<string, number>).lon
  if (!lat || !lon) throw new Error(`Could not geocode city: ${args.city}`)
  const data = await apiFetch<Record<string, unknown>[]>('/radius', {
    radius: '5000',
    limit: String(limit),
    lat: String(lat),
    lon: String(lon),
    rate: '3',
    format: 'json',
  })
  const items = Array.isArray(data) ? data : [data]
  return { city: args.city, lat, lon, count: items.length, results: items }
}, { method: 'get_attractions' })

const getAttractionDetail = sg.wrap(async (args: GetAttractionDetailInput) => {
  if (!args.xid || typeof args.xid !== 'string') {
    throw new Error('xid is required (attraction identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/xid/${encodeURIComponent(args.xid)}`)
  return { xid: args.xid, ...data }
}, { method: 'get_attraction_detail' })

export { getAttractions, getAttractionDetail }

console.log('settlegrid-tourist-attractions MCP server ready')
console.log('Methods: get_attractions, get_attraction_detail')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
