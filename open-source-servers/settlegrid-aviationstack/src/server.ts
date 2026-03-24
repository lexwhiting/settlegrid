/**
 * settlegrid-aviationstack — Aviationstack MCP Server
 *
 * Real-time and historical flight data from the Aviationstack API.
 *
 * Methods:
 *   search_flights(airline_iata, dep_iata) — Search real-time flights by airline or route  (2¢)
 *   get_airports(search)          — Search airports by name or IATA code  (2¢)
 *   get_airlines(search)          — Search airlines by name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchFlightsInput {
  airline_iata?: string
  dep_iata?: string
}

interface GetAirportsInput {
  search: string
}

interface GetAirlinesInput {
  search: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.aviationstack.com/v1'
const API_KEY = process.env.AVIATIONSTACK_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-aviationstack/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Aviationstack API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'aviationstack',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_flights: { costCents: 2, displayName: 'Search Flights' },
      get_airports: { costCents: 2, displayName: 'List Airports' },
      get_airlines: { costCents: 2, displayName: 'List Airlines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFlights = sg.wrap(async (args: SearchFlightsInput) => {
  const airline_iata = typeof args.airline_iata === 'string' ? args.airline_iata.trim() : ''
  const dep_iata = typeof args.dep_iata === 'string' ? args.dep_iata.trim() : ''
  const data = await apiFetch<any>(`/flights?airline_iata=${encodeURIComponent(airline_iata)}&dep_iata=${encodeURIComponent(dep_iata)}&access_key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        flight_date: item.flight_date,
        flight_status: item.flight_status,
        departure: item.departure,
        arrival: item.arrival,
        airline: item.airline,
        flight: item.flight,
    })),
  }
}, { method: 'search_flights' })

const getAirports = sg.wrap(async (args: GetAirportsInput) => {
  if (!args.search || typeof args.search !== 'string') throw new Error('search is required')
  const search = args.search.trim()
  const data = await apiFetch<any>(`/airports?search=${encodeURIComponent(search)}&access_key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        airport_name: item.airport_name,
        iata_code: item.iata_code,
        country_name: item.country_name,
        city_iata_code: item.city_iata_code,
        timezone: item.timezone,
    })),
  }
}, { method: 'get_airports' })

const getAirlines = sg.wrap(async (args: GetAirlinesInput) => {
  if (!args.search || typeof args.search !== 'string') throw new Error('search is required')
  const search = args.search.trim()
  const data = await apiFetch<any>(`/airlines?search=${encodeURIComponent(search)}&access_key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        airline_name: item.airline_name,
        iata_code: item.iata_code,
        country_name: item.country_name,
        fleet_size: item.fleet_size,
    })),
  }
}, { method: 'get_airlines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFlights, getAirports, getAirlines }

console.log('settlegrid-aviationstack MCP server ready')
console.log('Methods: search_flights, get_airports, get_airlines')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
