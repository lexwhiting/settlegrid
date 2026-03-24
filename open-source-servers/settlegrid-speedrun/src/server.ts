/**
 * settlegrid-speedrun — Speedrun.com Leaderboards MCP Server
 *
 * Methods:
 *   search_games(query)              (1¢)
 *   get_leaderboard(game_id, cat_id) (1¢)
 *   get_record(game_id)              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchGamesInput { query: string }
interface GetLeaderboardInput { game_id: string; category_id: string }
interface GetRecordInput { game_id: string }

const API_BASE = 'https://www.speedrun.com/api/v1'
const USER_AGENT = 'settlegrid-speedrun/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Speedrun.com API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'speedrun',
  pricing: { defaultCostCents: 1, methods: {
    search_games: { costCents: 1, displayName: 'Search speedrun games' },
    get_leaderboard: { costCents: 1, displayName: 'Get leaderboard' },
    get_record: { costCents: 1, displayName: 'Get world record' },
  }},
})

const searchGames = sg.wrap(async (args: SearchGamesInput) => {
  if (!args.query) throw new Error('query is required')
  return await apiFetch<Record<string, unknown>>('/games', { name: args.query, max: '20' })
}, { method: 'search_games' })

const getLeaderboard = sg.wrap(async (args: GetLeaderboardInput) => {
  if (!args.game_id || !args.category_id) throw new Error('game_id and category_id are required')
  return await apiFetch<Record<string, unknown>>(`/leaderboards/${args.game_id}/category/${args.category_id}`, { top: '20' })
}, { method: 'get_leaderboard' })

const getRecord = sg.wrap(async (args: GetRecordInput) => {
  if (!args.game_id) throw new Error('game_id is required')
  return await apiFetch<Record<string, unknown>>(`/games/${args.game_id}/records`, { top: '1' })
}, { method: 'get_record' })

export { searchGames, getLeaderboard, getRecord }

console.log('settlegrid-speedrun MCP server ready')
console.log('Methods: search_games, get_leaderboard, get_record')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
