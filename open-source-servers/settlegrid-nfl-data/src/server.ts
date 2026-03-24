/**
 * settlegrid-nfl-data — NFL Data MCP Server
 *
 * Methods:
 *   get_scoreboard(week?)   — NFL scores        (1¢)
 *   get_standings()         — NFL standings     (1¢)
 *   get_teams()             — List teams        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreboardInput { week?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

async function espnFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nfl-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Scoreboard' },
      get_standings: { costCents: 1, displayName: 'Standings' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: ScoreboardInput) => {
  const weekParam = args.week ? `?week=${args.week}` : ''
  const data = await espnFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ team: { displayName: string; abbreviation: string }; score: string; winner: boolean }> }> }> }>(`/scoreboard${weekParam}`)
  return {
    count: data.events?.length || 0,
    games: (data.events || []).map((e) => {
      const comp = e.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => (c as any).homeAway === 'home') || comp?.competitors?.[0]
      const away = comp?.competitors?.find((c: any) => (c as any).homeAway === 'away') || comp?.competitors?.[1]
      return {
        id: e.id,
        name: e.name,
        date: e.date,
        status: e.status?.type?.description,
        homeTeam: home?.team?.displayName,
        awayTeam: away?.team?.displayName,
        homeScore: home?.score,
        awayScore: away?.score,
      }
    }),
  }
}, { method: 'get_scoreboard' })

const getStandings = sg.wrap(async () => {
  const data = await espnFetch<{ children: Array<{ name: string; standings: { entries: Array<{ team: { displayName: string; abbreviation: string }; stats: Array<{ name: string; displayValue: string }> }> } }> }>('/standings')
  return {
    groups: (data.children || []).map((g) => ({
      name: g.name,
      teams: (g.standings?.entries || []).map((e) => {
        const getStat = (name: string) => e.stats?.find((s) => s.name === name)?.displayValue
        return {
          team: e.team?.displayName,
          abbr: e.team?.abbreviation,
          wins: getStat('wins'),
          losses: getStat('losses'),
          ties: getStat('ties'),
          pct: getStat('winPercent'),
        }
      }),
    })),
  }
}, { method: 'get_standings' })

const getTeams = sg.wrap(async () => {
  const data = await espnFetch<{ sports: Array<{ leagues: Array<{ teams: Array<{ team: { id: string; displayName: string; abbreviation: string; location: string; color: string } }> }> }> }>('/teams')
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || []
  return {
    count: teams.length,
    teams: teams.map((t) => ({
      id: t.team.id,
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      location: t.team.location,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getStandings, getTeams }

console.log('settlegrid-nfl-data MCP server ready')
console.log('Methods: get_scoreboard, get_standings, get_teams')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
