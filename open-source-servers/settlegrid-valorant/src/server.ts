/**
 * settlegrid-valorant — Valorant Match/Player Data MCP Server
 *
 * Methods:
 *   get_player(name, tag)            (1¢)
 *   get_match_history(name, tag)     (1¢)
 *   get_leaderboard(region)          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { name: string; tag: string }
interface LeaderboardInput { region?: string }

const API_BASE = 'https://api.henrikdev.xyz/valorant'
const USER_AGENT = 'settlegrid-valorant/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const key = process.env.HENRIK_API_KEY || ''
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  if (key) headers['Authorization'] = key
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`Valorant API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'valorant',
  pricing: { defaultCostCents: 1, methods: {
    get_player: { costCents: 1, displayName: 'Get player profile' },
    get_match_history: { costCents: 1, displayName: 'Get match history' },
    get_leaderboard: { costCents: 1, displayName: 'Get ranked leaderboard' },
  }},
})

const getPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name || !args.tag) throw new Error('name and tag are required')
  return await apiFetch<Record<string, unknown>>(`/v1/account/${encodeURIComponent(args.name)}/${encodeURIComponent(args.tag)}`)
}, { method: 'get_player' })

const getMatchHistory = sg.wrap(async (args: PlayerInput) => {
  if (!args.name || !args.tag) throw new Error('name and tag are required')
  return await apiFetch<Record<string, unknown>>(`/v3/matches/na/${encodeURIComponent(args.name)}/${encodeURIComponent(args.tag)}?size=5`)
}, { method: 'get_match_history' })

const getLeaderboard = sg.wrap(async (args: LeaderboardInput) => {
  const region = args.region || 'na'
  return await apiFetch<Record<string, unknown>>(`/v2/leaderboard/${encodeURIComponent(region)}`)
}, { method: 'get_leaderboard' })

export { getPlayer, getMatchHistory, getLeaderboard }

console.log('settlegrid-valorant MCP server ready')
console.log('Methods: get_player, get_match_history, get_leaderboard')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
