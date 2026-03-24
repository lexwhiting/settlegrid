/**
 * settlegrid-airline-routes — Airline Routes MCP Server
 *
 * Global airline route data from OpenFlights.
 *
 * Methods:
 *   get_airports(country)         — Get airport data (CSV parsed) by country  (1¢)
 *   get_airlines(country)         — Get airline data (CSV parsed) by country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAirportsInput {
  country: string
}

interface GetAirlinesInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-airline-routes/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Airline Routes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'airline-routes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_airports: { costCents: 1, displayName: 'List Airports' },
      get_airlines: { costCents: 1, displayName: 'List Airlines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAirports = sg.wrap(async (args: GetAirportsInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/airports.dat`)
  return {
    id: data.id,
    name: data.name,
    city: data.city,
    country: data.country,
    iata: data.iata,
    icao: data.icao,
    latitude: data.latitude,
    longitude: data.longitude,
  }
}, { method: 'get_airports' })

const getAirlines = sg.wrap(async (args: GetAirlinesInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/airlines.dat`)
  return {
    id: data.id,
    name: data.name,
    alias: data.alias,
    iata: data.iata,
    icao: data.icao,
    country: data.country,
    active: data.active,
  }
}, { method: 'get_airlines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAirports, getAirlines }

console.log('settlegrid-airline-routes MCP server ready')
console.log('Methods: get_airports, get_airlines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
