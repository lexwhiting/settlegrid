/**
 * settlegrid-airport-data — Airport Data MCP Server
 *
 * Wraps AirportDB API with SettleGrid billing.
 * No API key needed for basic queries.
 *
 * Methods:
 *   get_airport(icao) — airport by ICAO (1¢)
 *   search_airports(query) — search airports (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AirportInput { icao: string }
interface SearchInput { query: string }

const API_BASE = 'https://airportdb.io/api/v1'

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
  toolSlug: 'airport-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_airport: { costCents: 1, displayName: 'Get Airport' },
      search_airports: { costCents: 1, displayName: 'Search Airports' },
    },
  },
})

const getAirport = sg.wrap(async (args: AirportInput) => {
  if (!args.icao) throw new Error('ICAO code required')
  const code = args.icao.toUpperCase()
  const data = await apiFetch<any>(`/airports/${code}`)
  return {
    icao: data.icao_code, iata: data.iata_code, name: data.name,
    city: data.municipality, country: data.iso_country,
    latitude: data.latitude_deg, longitude: data.longitude_deg,
    elevation_ft: data.elevation_ft, type: data.type,
    continent: data.continent, region: data.iso_region,
    website: data.home_link, wikipedia: data.wikipedia_link,
  }
}, { method: 'get_airport' })

const searchAirports = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(`/airports?search=${encodeURIComponent(args.query)}&limit=20`)
  const items = Array.isArray(data) ? data : data.items || []
  return {
    airports: items.map((a: any) => ({
      icao: a.icao_code, iata: a.iata_code, name: a.name,
      city: a.municipality, country: a.iso_country, type: a.type,
    })),
  }
}, { method: 'search_airports' })

export { getAirport, searchAirports }

console.log('settlegrid-airport-data MCP server ready')
console.log('Methods: get_airport, search_airports')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
