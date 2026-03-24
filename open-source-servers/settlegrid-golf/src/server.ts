/**
 * settlegrid-golf — Golf MCP Server
 *
 * PGA Tour golf scores, leaderboards, and schedules via ESPN.
 *
 * Methods:
 *   get_scoreboard()              — Get current PGA tournament scores  (1¢)
 *   get_leaderboard(event_id)     — Get tournament leaderboard  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreboardInput {

}

interface GetLeaderboardInput {
  event_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-golf/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Golf API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'golf',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_leaderboard: { costCents: 1, displayName: 'Get Leaderboard' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {

  const data = await apiFetch<any>(`/pga/scoreboard`)
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

const getLeaderboard = sg.wrap(async (args: GetLeaderboardInput) => {
  if (!args.event_id || typeof args.event_id !== 'string') throw new Error('event_id is required')
  const event_id = args.event_id.trim()
  const data = await apiFetch<any>(`/pga/leaderboard?event=${encodeURIComponent(event_id)}`)
  const items = (data.competitors ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        score: item.score,
        position: item.position,
    })),
  }
}, { method: 'get_leaderboard' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getLeaderboard }

console.log('settlegrid-golf MCP server ready')
console.log('Methods: get_scoreboard, get_leaderboard')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
