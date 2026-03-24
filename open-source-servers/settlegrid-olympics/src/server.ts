/**
 * settlegrid-olympics — Olympic Games MCP Server
 *
 * Olympic Games data — events, athletes, countries, and disciplines.
 *
 * Methods:
 *   get_events()                  — Get Olympic events  (1¢)
 *   get_countries()               — Get participating countries and medal counts  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetEventsInput {

}

interface GetCountriesInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apis.codante.io/olympic-games'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-olympics/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Olympic Games API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'olympics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_events: { costCents: 1, displayName: 'Get Events' },
      get_countries: { costCents: 1, displayName: 'Get Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEvents = sg.wrap(async (args: GetEventsInput) => {

  const data = await apiFetch<any>(`/events`)
  const items = (data.data ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        sport: item.sport,
        discipline: item.discipline,
        event: item.event,
        venue: item.venue,
        date: item.date,
    })),
  }
}, { method: 'get_events' })

const getCountries = sg.wrap(async (args: GetCountriesInput) => {

  const data = await apiFetch<any>(`/countries`)
  const items = (data.data ?? []).slice(0, 30)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        continent: item.continent,
        gold: item.gold,
        silver: item.silver,
        bronze: item.bronze,
        total: item.total,
    })),
  }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getCountries }

console.log('settlegrid-olympics MCP server ready')
console.log('Methods: get_events, get_countries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
