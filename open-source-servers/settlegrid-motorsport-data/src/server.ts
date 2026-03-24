/**
 * settlegrid-motorsport-data — Motorsport Data MCP Server
 *
 * Wraps Ergast F1 API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_f1_standings(season?) — F1 standings (1¢)
 *   get_f1_schedule(season?) — F1 schedule (1¢)
 *   get_f1_race_result(season, round) — race result (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface StandingsInput { season?: string }
interface ScheduleInput { season?: string }
interface RaceInput { season: string; round: string }

const API_BASE = 'https://ergast.com/api/f1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}.json`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'motorsport-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_f1_standings: { costCents: 1, displayName: 'F1 Standings' },
      get_f1_schedule: { costCents: 1, displayName: 'F1 Schedule' },
      get_f1_race_result: { costCents: 1, displayName: 'F1 Race Result' },
    },
  },
})

const getF1Standings = sg.wrap(async (args: StandingsInput) => {
  const season = args.season || 'current'
  const data = await apiFetch<any>(`/${season}/driverStandings`)
  const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]
  return {
    season: standings?.season,
    drivers: (standings?.DriverStandings || []).map((d: any) => ({
      position: d.position, points: d.points, wins: d.wins,
      driver: `${d.Driver.givenName} ${d.Driver.familyName}`,
      nationality: d.Driver.nationality,
      constructor: d.Constructors?.[0]?.name,
    })),
  }
}, { method: 'get_f1_standings' })

const getF1Schedule = sg.wrap(async (args: ScheduleInput) => {
  const season = args.season || 'current'
  const data = await apiFetch<any>(`/${season}`)
  const races = data.MRData?.RaceTable?.Races || []
  return {
    season: data.MRData?.RaceTable?.season,
    races: races.map((r: any) => ({
      round: r.round, name: r.raceName, circuit: r.Circuit.circuitName,
      country: r.Circuit.Location.country, date: r.date, time: r.time,
    })),
  }
}, { method: 'get_f1_schedule' })

const getF1RaceResult = sg.wrap(async (args: RaceInput) => {
  if (!args.season || !args.round) throw new Error('season and round required')
  const data = await apiFetch<any>(`/${args.season}/${args.round}/results`)
  const race = data.MRData?.RaceTable?.Races?.[0]
  return {
    race: race?.raceName, circuit: race?.Circuit?.circuitName, date: race?.date,
    results: (race?.Results || []).map((r: any) => ({
      position: r.position, driver: `${r.Driver.givenName} ${r.Driver.familyName}`,
      constructor: r.Constructor.name, time: r.Time?.time, status: r.status,
      points: r.points, grid: r.grid, laps: r.laps,
    })),
  }
}, { method: 'get_f1_race_result' })

export { getF1Standings, getF1Schedule, getF1RaceResult }

console.log('settlegrid-motorsport-data MCP server ready')
console.log('Methods: get_f1_standings, get_f1_schedule, get_f1_race_result')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
