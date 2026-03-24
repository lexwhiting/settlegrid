/**
 * settlegrid-roblox — Roblox Game Data MCP Server
 *
 * Provides Roblox game details, user info, and group data.
 * Uses public Roblox APIs. No API key needed.
 *
 * Methods:
 *   get_game_details(universe_id)    (1¢)
 *   get_user_info(user_id)           (1¢)
 *   search_users(keyword)            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetGameInput { universe_id: string }
interface GetUserInput { user_id: string }
interface SearchUsersInput { keyword: string; limit?: number }

const GAMES_API = 'https://games.roblox.com/v1'
const USERS_API = 'https://users.roblox.com/v1'
const USER_AGENT = 'settlegrid-roblox/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Roblox API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'roblox',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_game_details: { costCents: 1, displayName: 'Get Roblox game details' },
      get_user_info: { costCents: 1, displayName: 'Get Roblox user info' },
      search_users: { costCents: 1, displayName: 'Search Roblox users' },
    },
  },
})

const getGameDetails = sg.wrap(async (args: GetGameInput) => {
  if (!args.universe_id) throw new Error('universe_id is required')
  const data = await apiFetch<Record<string, unknown>>(
    `${GAMES_API}/games?universeIds=${encodeURIComponent(args.universe_id)}`
  )
  return { universe_id: args.universe_id, ...data }
}, { method: 'get_game_details' })

const getUserInfo = sg.wrap(async (args: GetUserInput) => {
  if (!args.user_id) throw new Error('user_id is required')
  const data = await apiFetch<Record<string, unknown>>(
    `${USERS_API}/users/${encodeURIComponent(args.user_id)}`
  )
  return data
}, { method: 'get_user_info' })

const searchUsers = sg.wrap(async (args: SearchUsersInput) => {
  if (!args.keyword) throw new Error('keyword is required')
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const data = await apiFetch<Record<string, unknown>>(
    `${USERS_API}/users/search?keyword=${encodeURIComponent(args.keyword)}&limit=${limit}`
  )
  return { keyword: args.keyword, ...data }
}, { method: 'search_users' })

export { getGameDetails, getUserInfo, searchUsers }

console.log('settlegrid-roblox MCP server ready')
console.log('Methods: get_game_details, get_user_info, search_users')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
