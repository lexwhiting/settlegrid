/**
 * settlegrid-chess — Chess Data MCP Server
 *
 * Methods:
 *   get_player(username)         — Chess.com profile     (1¢)
 *   get_player_games(username)   — Recent games          (1¢)
 *   get_lichess_player(username) — Lichess profile       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayerInput { username: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHESS_BASE = 'https://api.chess.com/pub'
const LICHESS_BASE = 'https://lichess.org/api'

async function chessFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-chess/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chess API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateUsername(username: string): string {
  if (!username || typeof username !== 'string') throw new Error('username is required')
  const clean = username.trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,30}$/.test(clean)) throw new Error('Invalid username format')
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chess',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_player: { costCents: 1, displayName: 'Get Player' },
      get_player_games: { costCents: 1, displayName: 'Get Player Games' },
      get_lichess_player: { costCents: 1, displayName: 'Lichess Player' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPlayer = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const [profile, stats] = await Promise.all([
    chessFetch<{ username: string; title?: string; followers: number; country: string; joined: number; last_online: number }>(`${CHESS_BASE}/player/${user}`),
    chessFetch<{ chess_rapid?: { last: { rating: number }; record: { win: number; loss: number; draw: number } }; chess_blitz?: { last: { rating: number } }; chess_bullet?: { last: { rating: number } } }>(`${CHESS_BASE}/player/${user}/stats`),
  ])
  return {
    username: profile.username,
    title: profile.title,
    followers: profile.followers,
    joined: new Date(profile.joined * 1000).toISOString(),
    ratings: {
      rapid: stats.chess_rapid?.last?.rating,
      blitz: stats.chess_blitz?.last?.rating,
      bullet: stats.chess_bullet?.last?.rating,
    },
    rapidRecord: stats.chess_rapid?.record,
  }
}, { method: 'get_player' })

const getPlayerGames = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const data = await chessFetch<{ games: Array<{ url: string; time_class: string; white: { username: string; rating: number; result: string }; black: { username: string; rating: number; result: string } }> }>(`${CHESS_BASE}/player/${user}/games/${year}/${month}`)
  return {
    username: user,
    count: data.games?.length || 0,
    games: (data.games || []).slice(-10).reverse().map((g) => ({
      url: g.url,
      timeClass: g.time_class,
      white: { username: g.white.username, rating: g.white.rating, result: g.white.result },
      black: { username: g.black.username, rating: g.black.rating, result: g.black.result },
    })),
  }
}, { method: 'get_player_games' })

const getLichessPlayer = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const data = await chessFetch<{ id: string; username: string; title?: string; count: { all: number; win: number; loss: number; draw: number }; perfs: Record<string, { games: number; rating: number }> }>(`${LICHESS_BASE}/user/${user}`)
  return {
    username: data.username,
    title: data.title,
    totalGames: data.count?.all,
    record: { wins: data.count?.win, losses: data.count?.loss, draws: data.count?.draw },
    ratings: Object.fromEntries(
      Object.entries(data.perfs || {}).map(([k, v]) => [k, { rating: v.rating, games: v.games }])
    ),
  }
}, { method: 'get_lichess_player' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPlayer, getPlayerGames, getLichessPlayer }

console.log('settlegrid-chess MCP server ready')
console.log('Methods: get_player, get_player_games, get_lichess_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
