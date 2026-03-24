/**
 * settlegrid-chess-com — Chess.com Player Stats MCP Server
 *
 * Methods:
 *   get_player_stats(username)       (1¢)
 *   get_player_games(username)       (1¢)
 *   get_titled_players(title)        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { username: string }
interface TitledInput { title: string }

const API_BASE = 'https://api.chess.com/pub'
const USER_AGENT = 'settlegrid-chess-com/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Chess.com API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'chess-com',
  pricing: { defaultCostCents: 1, methods: {
    get_player_stats: { costCents: 1, displayName: 'Get player stats' },
    get_player_games: { costCents: 1, displayName: 'Get recent games' },
    get_titled_players: { costCents: 1, displayName: 'Get titled players' },
  }},
})

const getPlayerStats = sg.wrap(async (args: PlayerInput) => {
  if (!args.username) throw new Error('username is required')
  const [profile, stats] = await Promise.all([
    apiFetch<Record<string, unknown>>(`/player/${encodeURIComponent(args.username.toLowerCase())}`),
    apiFetch<Record<string, unknown>>(`/player/${encodeURIComponent(args.username.toLowerCase())}/stats`),
  ])
  return { username: args.username, profile, stats }
}, { method: 'get_player_stats' })

const getPlayerGames = sg.wrap(async (args: PlayerInput) => {
  if (!args.username) throw new Error('username is required')
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return await apiFetch<Record<string, unknown>>(`/player/${encodeURIComponent(args.username.toLowerCase())}/games/${y}/${m}`)
}, { method: 'get_player_games' })

const getTitledPlayers = sg.wrap(async (args: TitledInput) => {
  if (!args.title) throw new Error('title is required (GM, IM, FM, CM, WGM, etc.)')
  return await apiFetch<Record<string, unknown>>(`/titled/${encodeURIComponent(args.title.toUpperCase())}`)
}, { method: 'get_titled_players' })

export { getPlayerStats, getPlayerGames, getTitledPlayers }

console.log('settlegrid-chess-com MCP server ready')
console.log('Methods: get_player_stats, get_player_games, get_titled_players')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
