/**
 * settlegrid-fifa — FIFA MCP Server
 *
 * FIFA world football rankings and competition data via Football-Data.org.
 *
 * Methods:
 *   list_competitions()           — List available football competitions  (1¢)
 *   get_competition(competition_id) — Get competition details and standings  (1¢)
 *   get_team(team_id)             — Get team details and squad  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListCompetitionsInput {

}

interface GetCompetitionInput {
  competition_id: number
}

interface GetTeamInput {
  team_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-fifa/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FIFA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fifa',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_competitions: { costCents: 1, displayName: 'List Competitions' },
      get_competition: { costCents: 1, displayName: 'Get Competition' },
      get_team: { costCents: 1, displayName: 'Get Team' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCompetitions = sg.wrap(async (args: ListCompetitionsInput) => {

  const data = await apiFetch<any>(`/competitions`)
  const items = (data.competitions ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        area: item.area,
        currentSeason: item.currentSeason,
    })),
  }
}, { method: 'list_competitions' })

const getCompetition = sg.wrap(async (args: GetCompetitionInput) => {
  if (typeof args.competition_id !== 'number') throw new Error('competition_id is required and must be a number')
  const competition_id = args.competition_id
  const data = await apiFetch<any>(`/competitions/${competition_id}/standings`)
  const items = (data.standings ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        stage: item.stage,
        type: item.type,
        table: item.table,
    })),
  }
}, { method: 'get_competition' })

const getTeam = sg.wrap(async (args: GetTeamInput) => {
  if (typeof args.team_id !== 'number') throw new Error('team_id is required and must be a number')
  const team_id = args.team_id
  const data = await apiFetch<any>(`/teams/${team_id}`)
  return {
    id: data.id,
    name: data.name,
    shortName: data.shortName,
    crest: data.crest,
    venue: data.venue,
    squad: data.squad,
  }
}, { method: 'get_team' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCompetitions, getCompetition, getTeam }

console.log('settlegrid-fifa MCP server ready')
console.log('Methods: list_competitions, get_competition, get_team')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
