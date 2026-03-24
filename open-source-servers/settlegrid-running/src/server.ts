/**
 * settlegrid-running — Running MCP Server
 *
 * Marathon and running race data via RunSignUp API.
 *
 * Methods:
 *   search_races(query)           — Search for running races by name or location  (1¢)
 *   get_race(race_id)             — Get details for a specific race  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRacesInput {
  query: string
}

interface GetRaceInput {
  race_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://runsignup.com/Rest'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-running/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Running API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'running',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_races: { costCents: 1, displayName: 'Search Races' },
      get_race: { costCents: 1, displayName: 'Get Race' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRaces = sg.wrap(async (args: SearchRacesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/races?format=json&name=${encodeURIComponent(query)}&results_per_page=10`)
  const items = (data.races ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        race_id: item.race_id,
        name: item.name,
        next_date: item.next_date,
        city: item.city,
        state: item.state,
    })),
  }
}, { method: 'search_races' })

const getRace = sg.wrap(async (args: GetRaceInput) => {
  if (typeof args.race_id !== 'number') throw new Error('race_id is required and must be a number')
  const race_id = args.race_id
  const data = await apiFetch<any>(`/race/${race_id}?format=json`)
  return {
    race_id: data.race_id,
    name: data.name,
    next_date: data.next_date,
    address: data.address,
    description: data.description,
  }
}, { method: 'get_race' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRaces, getRace }

console.log('settlegrid-running MCP server ready')
console.log('Methods: search_races, get_race')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
