/**
 * settlegrid-balldontlie — BallDontLie NBA MCP Server
 *
 * Methods:
 *   get_season_averages(player_id, season?)  — Season averages      (1¢)
 *   get_player_stats(player_id, season?)     — Player game stats    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeasonAvgInput { player_id: number; season?: number }
interface PlayerStatsInput { player_id: number; season?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.balldontlie.io/v1'

async function bdlFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BallDontLie API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'balldontlie',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_season_averages: { costCents: 1, displayName: 'Season Averages' },
      get_player_stats: { costCents: 1, displayName: 'Player Game Stats' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeasonAverages = sg.wrap(async (args: SeasonAvgInput) => {
  if (typeof args.player_id !== 'number' || args.player_id <= 0) throw new Error('player_id must be a positive number')
  const seasonParam = args.season ? `&season=${args.season}` : ''
  const data = await bdlFetch<{ data: Array<{ games_played: number; pts: number; reb: number; ast: number; stl: number; blk: number; fg_pct: number; fg3_pct: number; ft_pct: number; min: string }> }>(`/season_averages?player_ids[]=${args.player_id}${seasonParam}`)
  const avg = data.data?.[0]
  if (!avg) return { playerId: args.player_id, message: 'No season averages found' }
  return {
    playerId: args.player_id,
    gamesPlayed: avg.games_played,
    ppg: avg.pts,
    rpg: avg.reb,
    apg: avg.ast,
    spg: avg.stl,
    bpg: avg.blk,
    fgPct: avg.fg_pct,
    fg3Pct: avg.fg3_pct,
    ftPct: avg.ft_pct,
    mpg: avg.min,
  }
}, { method: 'get_season_averages' })

const getPlayerStats = sg.wrap(async (args: PlayerStatsInput) => {
  if (typeof args.player_id !== 'number' || args.player_id <= 0) throw new Error('player_id must be a positive number')
  const seasonParam = args.season ? `&seasons[]=${args.season}` : ''
  const data = await bdlFetch<{ data: Array<{ game: { date: string; home_team_score: number; visitor_team_score: number }; pts: number; reb: number; ast: number; stl: number; blk: number; min: string }> }>(`/stats?player_ids[]=${args.player_id}${seasonParam}&per_page=10`)
  return {
    playerId: args.player_id,
    games: (data.data || []).map((s) => ({
      date: s.game?.date,
      points: s.pts,
      rebounds: s.reb,
      assists: s.ast,
      steals: s.stl,
      blocks: s.blk,
      minutes: s.min,
    })),
  }
}, { method: 'get_player_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeasonAverages, getPlayerStats }

console.log('settlegrid-balldontlie MCP server ready')
console.log('Methods: get_season_averages, get_player_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
