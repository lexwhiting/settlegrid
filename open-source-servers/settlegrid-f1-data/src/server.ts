/**
 * settlegrid-f1-data — Formula 1 (Ergast) MCP Server
 *
 * Formula 1 race data — drivers, constructors, and race results.
 *
 * Methods:
 *   get_drivers()                 — Get current season F1 drivers  (1¢)
 *   get_constructors()            — Get current season constructors  (1¢)
 *   get_results(season, round)    — Get results for a specific race in a season  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDriversInput {

}

interface GetConstructorsInput {

}

interface GetResultsInput {
  season: string
  round: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ergast.com/api/f1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-f1-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Formula 1 (Ergast) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'f1-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_drivers: { costCents: 1, displayName: 'Get Drivers' },
      get_constructors: { costCents: 1, displayName: 'Get Constructors' },
      get_results: { costCents: 1, displayName: 'Get Results' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDrivers = sg.wrap(async (args: GetDriversInput) => {

  const data = await apiFetch<any>(`/current/drivers.json`)
  const items = (data.MRData.DriverTable.Drivers ?? []).slice(0, 25)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        driverId: item.driverId,
        givenName: item.givenName,
        familyName: item.familyName,
        nationality: item.nationality,
        permanentNumber: item.permanentNumber,
    })),
  }
}, { method: 'get_drivers' })

const getConstructors = sg.wrap(async (args: GetConstructorsInput) => {

  const data = await apiFetch<any>(`/current/constructors.json`)
  const items = (data.MRData.ConstructorTable.Constructors ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        constructorId: item.constructorId,
        name: item.name,
        nationality: item.nationality,
        url: item.url,
    })),
  }
}, { method: 'get_constructors' })

const getResults = sg.wrap(async (args: GetResultsInput) => {
  if (!args.season || typeof args.season !== 'string') throw new Error('season is required')
  const season = args.season.trim()
  if (!args.round || typeof args.round !== 'string') throw new Error('round is required')
  const round = args.round.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(season)}/${encodeURIComponent(round)}/results.json`)
  const items = (data.MRData.RaceTable.Races ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        raceName: item.raceName,
        date: item.date,
        Circuit: item.Circuit,
        Results: item.Results,
    })),
  }
}, { method: 'get_results' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDrivers, getConstructors, getResults }

console.log('settlegrid-f1-data MCP server ready')
console.log('Methods: get_drivers, get_constructors, get_results')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
