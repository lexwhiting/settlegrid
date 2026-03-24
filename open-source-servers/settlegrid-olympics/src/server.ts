/**
 * settlegrid-olympics — Olympic Games MCP Server
 *
 * Methods:
 *   get_events()       — Olympic events       (1¢)
 *   get_countries()    — Countries & medals   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apis.codante.io/olympic-games'

async function olympicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Olympic API ${res.status}: ${body.slice(0, 200)}`)
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

const getEvents = sg.wrap(async () => {
  const data = await olympicFetch<{ data: Array<{ id: number; discipline: string; event: string; venue: string; date: string; status: string }> }>('/events')
  return {
    count: data.data?.length || 0,
    events: (data.data || []).slice(0, 25).map((e) => ({
      id: e.id,
      discipline: e.discipline,
      event: e.event,
      venue: e.venue,
      date: e.date,
      status: e.status,
    })),
  }
}, { method: 'get_events' })

const getCountries = sg.wrap(async () => {
  const data = await olympicFetch<{ data: Array<{ id: string; name: string; gold: number; silver: number; bronze: number; total: number }> }>('/countries')
  return {
    count: data.data?.length || 0,
    countries: (data.data || []).slice(0, 30).map((c) => ({
      code: c.id,
      name: c.name,
      gold: c.gold,
      silver: c.silver,
      bronze: c.bronze,
      total: c.total,
    })),
  }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getCountries }

console.log('settlegrid-olympics MCP server ready')
console.log('Methods: get_events, get_countries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
