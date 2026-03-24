/**
 * settlegrid-flightaware — FlightAware AeroAPI MCP Server
 *
 * Flight tracking, status, and airport data from FlightAware AeroAPI.
 *
 * Methods:
 *   get_flight(flight_id)         — Get flight information by flight ID  (2¢)
 *   get_airport_flights(airport_code) — Get flights at an airport  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFlightInput {
  flight_id: string
}

interface GetAirportFlightsInput {
  airport_code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://aeroapi.flightaware.com/aeroapi'
const API_KEY = process.env.FLIGHTAWARE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-flightaware/1.0', 'x-apikey': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FlightAware AeroAPI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'flightaware',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_flight: { costCents: 2, displayName: 'Flight Info' },
      get_airport_flights: { costCents: 2, displayName: 'Airport Flights' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlight = sg.wrap(async (args: GetFlightInput) => {
  if (!args.flight_id || typeof args.flight_id !== 'string') throw new Error('flight_id is required')
  const flight_id = args.flight_id.trim()
  const data = await apiFetch<any>(`/flights/${encodeURIComponent(flight_id)}`)
  return {
    ident: data.ident,
    operator: data.operator,
    origin: data.origin,
    destination: data.destination,
    status: data.status,
    scheduled_out: data.scheduled_out,
    actual_out: data.actual_out,
  }
}, { method: 'get_flight' })

const getAirportFlights = sg.wrap(async (args: GetAirportFlightsInput) => {
  if (!args.airport_code || typeof args.airport_code !== 'string') throw new Error('airport_code is required')
  const airport_code = args.airport_code.trim()
  const data = await apiFetch<any>(`/airports/${encodeURIComponent(airport_code)}/flights`)
  const items = (data.arrivals ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        ident: item.ident,
        origin: item.origin,
        destination: item.destination,
        status: item.status,
    })),
  }
}, { method: 'get_airport_flights' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlight, getAirportFlights }

console.log('settlegrid-flightaware MCP server ready')
console.log('Methods: get_flight, get_airport_flights')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
