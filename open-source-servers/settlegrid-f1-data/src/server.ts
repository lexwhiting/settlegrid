/**
 * settlegrid-f1-data — Formula 1 MCP Server
 *
 * Methods:
 *   get_driver_standings(season?)      — Driver standings    (1¢)
 *   get_race_results(season, round)    — Race results        (1¢)
 *   get_schedule(season?)              — Race schedule       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { season?: string }
interface RaceResultsInput { season: string; round: number }
interface ScheduleInput { season?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ergast.com/api/f1'

async function f1Fetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}.json`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ergast API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'f1-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_driver_standings: { costCents: 1, displayName: 'Driver Standings' },
      get_race_results: { costCents: 1, displayName: 'Race Results' },
      get_schedule: { costCents: 1, displayName: 'Race Schedule' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDriverStandings = sg.wrap(async (args: StandingsInput) => {
  const season = args.season || 'current'
  const data = await f1Fetch<{ MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: Array<{ position: string; points: string; wins: string; Driver: { givenName: string; familyName: string; nationality: string }; Constructors: Array<{ name: string }> }> }> } } }>(`/${season}/driverStandings`)
  const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
  return {
    season,
    drivers: standings.map((d) => ({
      position: parseInt(d.position, 10),
      name: `${d.Driver.givenName} ${d.Driver.familyName}`,
      nationality: d.Driver.nationality,
      team: d.Constructors?.[0]?.name,
      points: parseFloat(d.points),
      wins: parseInt(d.wins, 10),
    })),
  }
}, { method: 'get_driver_standings' })

const getRaceResults = sg.wrap(async (args: RaceResultsInput) => {
  if (!args.season) throw new Error('season is required')
  if (typeof args.round !== 'number' || args.round < 1) throw new Error('round must be a positive number')
  const data = await f1Fetch<{ MRData: { RaceTable: { Races: Array<{ raceName: string; date: string; Circuit: { circuitName: string; Location: { country: string } }; Results: Array<{ position: string; Driver: { givenName: string; familyName: string }; Constructor: { name: string }; status: string; Time?: { time: string } }> }> } } }>(`/${args.season}/${args.round}/results`)
  const race = data.MRData?.RaceTable?.Races?.[0]
  if (!race) throw new Error(`No results for ${args.season} round ${args.round}`)
  return {
    raceName: race.raceName,
    date: race.date,
    circuit: race.Circuit?.circuitName,
    country: race.Circuit?.Location?.country,
    results: (race.Results || []).map((r) => ({
      position: parseInt(r.position, 10),
      driver: `${r.Driver.givenName} ${r.Driver.familyName}`,
      team: r.Constructor?.name,
      status: r.status,
      time: r.Time?.time,
    })),
  }
}, { method: 'get_race_results' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  const season = args.season || 'current'
  const data = await f1Fetch<{ MRData: { RaceTable: { Races: Array<{ round: string; raceName: string; date: string; time: string; Circuit: { circuitName: string; Location: { country: string; locality: string } } }> } } }>(`/${season}`)
  return {
    season,
    races: (data.MRData?.RaceTable?.Races || []).map((r) => ({
      round: parseInt(r.round, 10),
      name: r.raceName,
      date: r.date,
      time: r.time,
      circuit: r.Circuit?.circuitName,
      location: `${r.Circuit?.Location?.locality}, ${r.Circuit?.Location?.country}`,
    })),
  }
}, { method: 'get_schedule' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDriverStandings, getRaceResults, getSchedule }

console.log('settlegrid-f1-data MCP server ready')
console.log('Methods: get_driver_standings, get_race_results, get_schedule')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
