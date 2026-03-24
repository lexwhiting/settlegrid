/**
 * settlegrid-opensky — OpenSky Network MCP Server
 *
 * Live flight tracking and aircraft state vectors from the OpenSky Network.
 *
 * Methods:
 *   get_states()                  — Get current state vectors for all aircraft  (1¢)
 *   get_flights_by_aircraft(icao24) — Get flights for a specific aircraft by ICAO24 address  (1¢)
 *   get_track(icao24)             — Get waypoints for a specific flight  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStatesInput {

}

interface GetFlightsByAircraftInput {
  icao24: string
}

interface GetTrackInput {
  icao24: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://opensky-network.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-opensky/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenSky Network API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opensky',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_states: { costCents: 1, displayName: 'All State Vectors' },
      get_flights_by_aircraft: { costCents: 1, displayName: 'Flights by Aircraft' },
      get_track: { costCents: 1, displayName: 'Flight Track' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStates = sg.wrap(async (args: GetStatesInput) => {

  const data = await apiFetch<any>(`/states/all`)
  const items = (data.states ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        icao24: item.icao24,
        callsign: item.callsign,
        origin_country: item.origin_country,
        longitude: item.longitude,
        latitude: item.latitude,
        baro_altitude: item.baro_altitude,
        velocity: item.velocity,
    })),
  }
}, { method: 'get_states' })

const getFlightsByAircraft = sg.wrap(async (args: GetFlightsByAircraftInput) => {
  if (!args.icao24 || typeof args.icao24 !== 'string') throw new Error('icao24 is required')
  const icao24 = args.icao24.trim()
  const data = await apiFetch<any>(`/flights/aircraft?icao24=${encodeURIComponent(icao24)}&begin=0&end=9999999999`)
  const items = (data.flights ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        icao24: item.icao24,
        firstSeen: item.firstSeen,
        lastSeen: item.lastSeen,
        estDepartureAirport: item.estDepartureAirport,
        estArrivalAirport: item.estArrivalAirport,
    })),
  }
}, { method: 'get_flights_by_aircraft' })

const getTrack = sg.wrap(async (args: GetTrackInput) => {
  if (!args.icao24 || typeof args.icao24 !== 'string') throw new Error('icao24 is required')
  const icao24 = args.icao24.trim()
  const data = await apiFetch<any>(`/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`)
  return {
    icao24: data.icao24,
    callsign: data.callsign,
    startTime: data.startTime,
    endTime: data.endTime,
    path: data.path,
  }
}, { method: 'get_track' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStates, getFlightsByAircraft, getTrack }

console.log('settlegrid-opensky MCP server ready')
console.log('Methods: get_states, get_flights_by_aircraft, get_track')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
