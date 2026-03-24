/**
 * settlegrid-flight-prices — Flight Price Data MCP Server
 *
 * Provides flight route and pricing data via AviationStack.
 * Free tier available.
 *
 * Methods:
 *   search_flights(dep_iata, arr_iata)    (2¢)
 *   get_flight_status(flight_iata)        (1¢)
 *   get_routes(airline_iata)              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchFlightsInput { dep_iata: string; arr_iata: string }
interface GetFlightStatusInput { flight_iata: string }
interface GetRoutesInput { airline_iata: string }

const API_BASE = 'https://api.aviationstack.com/v1'
const USER_AGENT = 'settlegrid-flight-prices/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  const key = process.env.AVIATIONSTACK_API_KEY || ''
  if (key) url.searchParams.set('access_key', key)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AviationStack API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'flight-prices',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_flights: { costCents: 2, displayName: 'Search flights between airports' },
      get_flight_status: { costCents: 1, displayName: 'Get flight status' },
      get_routes: { costCents: 1, displayName: 'Get airline routes' },
    },
  },
})

const searchFlights = sg.wrap(async (args: SearchFlightsInput) => {
  if (!args.dep_iata || !args.arr_iata) {
    throw new Error('dep_iata and arr_iata are required (IATA codes)')
  }
  const data = await apiFetch<Record<string, unknown>>('/flights', {
    dep_iata: args.dep_iata.toUpperCase(),
    arr_iata: args.arr_iata.toUpperCase(),
    limit: '20',
  })
  return { from: args.dep_iata.toUpperCase(), to: args.arr_iata.toUpperCase(), ...data }
}, { method: 'search_flights' })

const getFlightStatus = sg.wrap(async (args: GetFlightStatusInput) => {
  if (!args.flight_iata || typeof args.flight_iata !== 'string') {
    throw new Error('flight_iata is required (e.g. AA100, BA215)')
  }
  const data = await apiFetch<Record<string, unknown>>('/flights', {
    flight_iata: args.flight_iata.toUpperCase(),
  })
  return { flight: args.flight_iata.toUpperCase(), ...data }
}, { method: 'get_flight_status' })

const getRoutes = sg.wrap(async (args: GetRoutesInput) => {
  if (!args.airline_iata || typeof args.airline_iata !== 'string') {
    throw new Error('airline_iata is required (e.g. AA, BA, LH)')
  }
  const data = await apiFetch<Record<string, unknown>>('/routes', {
    airline_iata: args.airline_iata.toUpperCase(),
    limit: '50',
  })
  return { airline: args.airline_iata.toUpperCase(), ...data }
}, { method: 'get_routes' })

export { searchFlights, getFlightStatus, getRoutes }

console.log('settlegrid-flight-prices MCP server ready')
console.log('Methods: search_flights, get_flight_status, get_routes')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
