/**
 * settlegrid-nfl-data — NFL Data (ESPN) MCP Server
 *
 * NFL football data — teams, scores, and standings via ESPN API.
 *
 * Methods:
 *   get_scoreboard()              — Get current/recent NFL scores  (1¢)
 *   get_teams()                   — List all NFL teams  (1¢)
 *   get_news()                    — Get latest NFL news headlines  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreboardInput {

}

interface GetTeamsInput {

}

interface GetNewsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nfl-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NFL Data (ESPN) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nfl-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
      get_news: { costCents: 1, displayName: 'Get News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {

  const data = await apiFetch<any>(`/scoreboard`)
  const items = (data.events ?? []).slice(0, 16)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        date: item.date,
        status: item.status,
        competitions: item.competitions,
    })),
  }
}, { method: 'get_scoreboard' })

const getTeams = sg.wrap(async (args: GetTeamsInput) => {

  const data = await apiFetch<any>(`/teams`)
  const items = (data.sports[0].leagues[0].teams ?? []).slice(0, 32)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        team: item.team,
    })),
  }
}, { method: 'get_teams' })

const getNews = sg.wrap(async (args: GetNewsInput) => {

  const data = await apiFetch<any>(`/news`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        headline: item.headline,
        description: item.description,
        published: item.published,
        links: item.links,
    })),
  }
}, { method: 'get_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getTeams, getNews }

console.log('settlegrid-nfl-data MCP server ready')
console.log('Methods: get_scoreboard, get_teams, get_news')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
