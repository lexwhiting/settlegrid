/**
 * settlegrid-cricket — Cricket API MCP Server
 *
 * Cricket data — live scores, matches, and player stats.
 *
 * Methods:
 *   get_matches()                 — Get current and recent cricket matches  (2¢)
 *   search_players(query)         — Search cricket players by name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetMatchesInput {

}

interface SearchPlayersInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.cricapi.com/v1'
const API_KEY = process.env.CRICKET_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-cricket/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cricket API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cricket',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_matches: { costCents: 2, displayName: 'Get Matches' },
      search_players: { costCents: 2, displayName: 'Search Players' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMatches = sg.wrap(async (args: GetMatchesInput) => {

  const data = await apiFetch<any>(`/currentMatches?apikey=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        matchType: item.matchType,
        status: item.status,
        venue: item.venue,
        teams: item.teams,
        score: item.score,
    })),
  }
}, { method: 'get_matches' })

const searchPlayers = sg.wrap(async (args: SearchPlayersInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/players?search=${encodeURIComponent(query)}&apikey=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        country: item.country,
    })),
  }
}, { method: 'search_players' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMatches, searchPlayers }

console.log('settlegrid-cricket MCP server ready')
console.log('Methods: get_matches, search_players')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
