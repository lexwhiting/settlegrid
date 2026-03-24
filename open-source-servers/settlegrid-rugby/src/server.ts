/**
 * settlegrid-rugby — Rugby Data MCP Server
 *
 * Methods:
 *   get_scoreboard(league?)   — Rugby scores     (1¢)
 *   get_teams(league?)        — List teams       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeagueInput { league?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/rugby'

async function rugbyFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN Rugby API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rugby',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Rugby Scoreboard' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: LeagueInput) => {
  const league = args.league || 'world-rugby'
  const data = await rugbyFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ team: { displayName: string }; score: string }> }> }> }>(`/${league}/scoreboard`)
  return {
    league,
    count: data.events?.length || 0,
    matches: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      team1: e.competitions?.[0]?.competitors?.[0]?.team?.displayName,
      team2: e.competitions?.[0]?.competitors?.[1]?.team?.displayName,
      score1: e.competitions?.[0]?.competitors?.[0]?.score,
      score2: e.competitions?.[0]?.competitors?.[1]?.score,
    })),
  }
}, { method: 'get_scoreboard' })

const getTeams = sg.wrap(async (args: LeagueInput) => {
  const league = args.league || 'world-rugby'
  const data = await rugbyFetch<{ sports: Array<{ leagues: Array<{ teams: Array<{ team: { id: string; displayName: string; abbreviation: string; location: string } }> }> }> }>(`/${league}/teams`)
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || []
  return {
    league,
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

export { getScoreboard, getTeams }

console.log('settlegrid-rugby MCP server ready')
console.log('Methods: get_scoreboard, get_teams')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
