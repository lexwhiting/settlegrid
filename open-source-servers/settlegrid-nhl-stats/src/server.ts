/**
 * settlegrid-nhl-stats — NHL Stats MCP Server
 *
 * National Hockey League data — teams, standings, and schedules.
 *
 * Methods:
 *   get_standings()               — Get current NHL standings  (1¢)
 *   get_scores(date)              — Get scores for a specific date  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStandingsInput {

}

interface GetScoresInput {
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api-web.nhle.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nhl-stats/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NHL Stats API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nhl-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_standings: { costCents: 1, displayName: 'Get Standings' },
      get_scores: { costCents: 1, displayName: 'Get Scores' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: GetStandingsInput) => {

  const data = await apiFetch<any>(`/standings/now`)
  const items = (data.standings ?? []).slice(0, 32)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        teamAbbrev: item.teamAbbrev,
        teamName: item.teamName,
        gamesPlayed: item.gamesPlayed,
        wins: item.wins,
        losses: item.losses,
        points: item.points,
    })),
  }
}, { method: 'get_standings' })

const getScores = sg.wrap(async (args: GetScoresInput) => {
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  const date = args.date.trim()
  const data = await apiFetch<any>(`/score/${encodeURIComponent(date)}`)
  const items = (data.games ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        startTimeUTC: item.startTimeUTC,
        awayTeam: item.awayTeam,
        homeTeam: item.homeTeam,
        gameState: item.gameState,
    })),
  }
}, { method: 'get_scores' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getScores }

console.log('settlegrid-nhl-stats MCP server ready')
console.log('Methods: get_standings, get_scores')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
