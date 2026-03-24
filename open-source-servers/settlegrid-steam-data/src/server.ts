/**
 * settlegrid-steam-data — Steam Game Data MCP Server
 *
 * Provides Steam game info, pricing, and player counts.
 * Uses the Steam Store API. No API key needed.
 *
 * Methods:
 *   get_game_details(app_id)          (1¢)
 *   search_games(query)               (1¢)
 *   get_top_games()                   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetGameDetailsInput { app_id: string }
interface SearchGamesInput { query: string }
interface GetTopGamesInput { limit?: number }

const STORE_API = 'https://store.steampowered.com/api'
const SPY_API = 'https://steamspy.com/api.php'
const USER_AGENT = 'settlegrid-steam-data/1.0 (contact@settlegrid.ai)'

async function storeFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${STORE_API}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Steam API ${res.status}`)
  return res.json() as Promise<T>
}

async function spyFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(SPY_API)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`SteamSpy API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'steam-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_game_details: { costCents: 1, displayName: 'Get Steam game details' },
      search_games: { costCents: 1, displayName: 'Search Steam games' },
      get_top_games: { costCents: 1, displayName: 'Get top Steam games' },
    },
  },
})

const getGameDetails = sg.wrap(async (args: GetGameDetailsInput) => {
  if (!args.app_id) throw new Error('app_id is required (Steam app ID)')
  const data = await storeFetch<Record<string, unknown>>('/appdetails', { appids: args.app_id })
  return { app_id: args.app_id, ...data }
}, { method: 'get_game_details' })

const searchGames = sg.wrap(async (args: SearchGamesInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await storeFetch<Record<string, unknown>>('/storesearch', {
    term: args.query,
    l: 'english',
    cc: 'US',
  })
  return { query: args.query, ...data }
}, { method: 'search_games' })

const getTopGames = sg.wrap(async (args: GetTopGamesInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await spyFetch<Record<string, unknown>>({ request: 'top100in2weeks' })
  const entries = Object.entries(data).slice(0, limit)
  return { limit, count: entries.length, results: entries.map(([id, info]) => ({ app_id: id, ...(info as Record<string, unknown>) })) }
}, { method: 'get_top_games' })

export { getGameDetails, searchGames, getTopGames }

console.log('settlegrid-steam-data MCP server ready')
console.log('Methods: get_game_details, search_games, get_top_games')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
