/**
 * settlegrid-esports — Esports Data MCP Server
 *
 * Methods:
 *   get_matches(game?, status?)   — Esports matches       (2¢)
 *   get_tournaments(game?)        — Esports tournaments   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchesInput { game?: string; status?: string }
interface TournamentsInput { game?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.pandascore.co'
const TOKEN = process.env.PANDASCORE_TOKEN || ''

async function pandaFetch<T>(path: string): Promise<T> {
  if (!TOKEN) throw new Error('PANDASCORE_TOKEN environment variable is required')
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PandaScore API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'esports',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_matches: { costCents: 2, displayName: 'Get Matches' },
      get_tournaments: { costCents: 2, displayName: 'Get Tournaments' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMatches = sg.wrap(async (args: MatchesInput) => {
  const validStatus = ['upcoming', 'running', 'past']
  const status = args.status && validStatus.includes(args.status) ? args.status : 'upcoming'
  let path = `/matches/${status}?per_page=10`
  if (args.game) {
    path = `/${encodeURIComponent(args.game)}/matches/${status}?per_page=10`
  }
  const data = await pandaFetch<Array<{ id: number; name: string; begin_at: string; status: string; league: { name: string }; opponents: Array<{ opponent: { name: string } }>; results: Array<{ team_id: number; score: number }> }>>(path)
  return {
    status,
    game: args.game || 'all',
    matches: data.map((m) => ({
      id: m.id,
      name: m.name,
      startAt: m.begin_at,
      status: m.status,
      league: m.league?.name,
      opponents: m.opponents?.map((o) => o.opponent?.name),
      results: m.results,
    })),
  }
}, { method: 'get_matches' })

const getTournaments = sg.wrap(async (args: TournamentsInput) => {
  let path = '/tournaments?per_page=10&sort=-begin_at'
  if (args.game) {
    path = `/${encodeURIComponent(args.game)}/tournaments?per_page=10&sort=-begin_at`
  }
  const data = await pandaFetch<Array<{ id: number; name: string; begin_at: string; end_at: string; league: { name: string }; serie: { full_name: string }; prizepool: string }>>(path)
  return {
    game: args.game || 'all',
    tournaments: data.map((t) => ({
      id: t.id,
      name: t.name,
      startAt: t.begin_at,
      endAt: t.end_at,
      league: t.league?.name,
      series: t.serie?.full_name,
      prizepool: t.prizepool,
    })),
  }
}, { method: 'get_tournaments' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMatches, getTournaments }

console.log('settlegrid-esports MCP server ready')
console.log('Methods: get_matches, get_tournaments')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
