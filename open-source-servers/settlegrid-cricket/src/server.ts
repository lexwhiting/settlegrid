/**
 * settlegrid-cricket — Cricket Data MCP Server
 *
 * Methods:
 *   get_matches()   — Current matches    (2¢)
 *   get_series()    — Series list        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.cricapi.com/v1'
const API_KEY = process.env.CRICAPI_KEY || ''

async function cricFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('CRICAPI_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}apikey=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CricAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cricket',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_matches: { costCents: 2, displayName: 'Current Matches' },
      get_series: { costCents: 2, displayName: 'Get Series' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMatches = sg.wrap(async () => {
  const data = await cricFetch<{ data: Array<{ id: string; name: string; status: string; venue: string; date: string; teams: string[]; score: Array<{ r: number; w: number; o: number; inning: string }> }> }>('/currentMatches')
  return {
    count: data.data?.length || 0,
    matches: (data.data || []).slice(0, 15).map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      venue: m.venue,
      date: m.date,
      teams: m.teams,
      score: m.score,
    })),
  }
}, { method: 'get_matches' })

const getSeries = sg.wrap(async () => {
  const data = await cricFetch<{ data: Array<{ id: string; name: string; startDate: string; endDate: string; odi: number; t20: number; test: number }> }>('/series')
  return {
    count: data.data?.length || 0,
    series: (data.data || []).slice(0, 20).map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      odi: s.odi,
      t20: s.t20,
      test: s.test,
    })),
  }
}, { method: 'get_series' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMatches, getSeries }

console.log('settlegrid-cricket MCP server ready')
console.log('Methods: get_matches, get_series')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
