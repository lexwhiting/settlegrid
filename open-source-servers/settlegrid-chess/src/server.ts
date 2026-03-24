/**
 * settlegrid-chess — Chess MCP Server
 *
 * Chess player stats and games via Chess.com and Lichess APIs.
 *
 * Methods:
 *   get_player(username)          — Get Chess.com player profile  (1¢)
 *   get_player_stats(username)    — Get Chess.com player rating stats  (1¢)
 *   get_lichess_user(username)    — Get Lichess player profile and ratings  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPlayerInput {
  username: string
}

interface GetPlayerStatsInput {
  username: string
}

interface GetLichessUserInput {
  username: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.chess.com/pub'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-chess/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chess API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chess',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_player: { costCents: 1, displayName: 'Get Player' },
      get_player_stats: { costCents: 1, displayName: 'Get Player Stats' },
      get_lichess_user: { costCents: 1, displayName: 'Get Lichess User' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPlayer = sg.wrap(async (args: GetPlayerInput) => {
  if (!args.username || typeof args.username !== 'string') throw new Error('username is required')
  const username = args.username.trim()
  const data = await apiFetch<any>(`/player/${encodeURIComponent(username)}`)
  return {
    username: data.username,
    title: data.title,
    followers: data.followers,
    country: data.country,
    joined: data.joined,
    last_online: data.last_online,
  }
}, { method: 'get_player' })

const getPlayerStats = sg.wrap(async (args: GetPlayerStatsInput) => {
  if (!args.username || typeof args.username !== 'string') throw new Error('username is required')
  const username = args.username.trim()
  const data = await apiFetch<any>(`/player/${encodeURIComponent(username)}/stats`)
  return {
    chess_rapid: data.chess_rapid,
    chess_blitz: data.chess_blitz,
    chess_bullet: data.chess_bullet,
  }
}, { method: 'get_player_stats' })

const getLichessUser = sg.wrap(async (args: GetLichessUserInput) => {
  if (!args.username || typeof args.username !== 'string') throw new Error('username is required')
  const username = args.username.trim()
  const data = await apiFetch<any>(`/../../../lichess.org/api/user/${encodeURIComponent(username)}`)
  return {
    id: data.id,
    username: data.username,
    perfs: data.perfs,
    count: data.count,
    playing: data.playing,
  }
}, { method: 'get_lichess_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPlayer, getPlayerStats, getLichessUser }

console.log('settlegrid-chess MCP server ready')
console.log('Methods: get_player, get_player_stats, get_lichess_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
