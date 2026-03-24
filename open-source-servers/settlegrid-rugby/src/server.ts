/**
 * settlegrid-rugby — Rugby MCP Server
 *
 * Rugby union scores, teams, and schedules via ESPN.
 *
 * Methods:
 *   get_scoreboard()              — Get current rugby match scores  (1¢)
 *   get_teams()                   — Get rugby teams list  (1¢)
 *   get_team(team_id)             — Get details for a specific rugby team  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreboardInput {

}

interface GetTeamsInput {

}

interface GetTeamInput {
  team_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/rugby'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-rugby/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Rugby API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rugby',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
      get_team: { costCents: 1, displayName: 'Get Team' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {

  const data = await apiFetch<any>(`/scoreboard`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        status: item.status,
    })),
  }
}, { method: 'get_scoreboard' })

const getTeams = sg.wrap(async (args: GetTeamsInput) => {

  const data = await apiFetch<any>(`/teams`)
  const items = (data.teams ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        displayName: item.displayName,
        abbreviation: item.abbreviation,
    })),
  }
}, { method: 'get_teams' })

const getTeam = sg.wrap(async (args: GetTeamInput) => {
  if (!args.team_id || typeof args.team_id !== 'string') throw new Error('team_id is required')
  const team_id = args.team_id.trim()
  const data = await apiFetch<any>(`/teams/${encodeURIComponent(team_id)}`)
  return {
    id: data.id,
    displayName: data.displayName,
    abbreviation: data.abbreviation,
    record: data.record,
  }
}, { method: 'get_team' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getTeams, getTeam }

console.log('settlegrid-rugby MCP server ready')
console.log('Methods: get_scoreboard, get_teams, get_team')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
