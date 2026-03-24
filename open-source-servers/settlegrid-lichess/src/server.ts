/**
 * settlegrid-lichess — Lichess Player/Game Data MCP Server
 *
 * Methods:
 *   get_player(username)             (1¢)
 *   get_player_games(username)       (1¢)
 *   get_leaderboard(variant, count)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { username: string }
interface LeaderboardInput { variant?: string; count?: number }

const API_BASE = 'https://lichess.org/api'
const USER_AGENT = 'settlegrid-lichess/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Lichess API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'lichess',
  pricing: { defaultCostCents: 1, methods: {
    get_player: { costCents: 1, displayName: 'Get player profile' },
    get_player_games: { costCents: 1, displayName: 'Get recent games' },
    get_leaderboard: { costCents: 1, displayName: 'Get leaderboard' },
  }},
})

const getPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.username) throw new Error('username is required')
  return await apiFetch<Record<string, unknown>>(`/user/${encodeURIComponent(args.username)}`)
}, { method: 'get_player' })

const getPlayerGames = sg.wrap(async (args: PlayerInput) => {
  if (!args.username) throw new Error('username is required')
  const res = await fetch(`${API_BASE}/games/user/${encodeURIComponent(args.username)}?max=10&pgnInJson=true`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/x-ndjson' },
  })
  if (!res.ok) throw new Error(`Lichess API ${res.status}`)
  const text = await res.text()
  const games = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).slice(0, 10)
  return { username: args.username, count: games.length, games }
}, { method: 'get_player_games' })

const getLeaderboard = sg.wrap(async (args: LeaderboardInput) => {
  const variant = args.variant || 'bullet'
  const count = Math.min(Math.max(args.count ?? 10, 1), 200)
  return await apiFetch<Record<string, unknown>>(`/player/top/${count}/${variant}`)
}, { method: 'get_leaderboard' })

export { getPlayer, getPlayerGames, getLeaderboard }

console.log('settlegrid-lichess MCP server ready')
console.log('Methods: get_player, get_player_games, get_leaderboard')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
