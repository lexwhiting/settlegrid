/**
 * settlegrid-tennis — Tennis Data MCP Server
 *
 * Methods:
 *   get_scoreboard(tour?)   — Tennis scores      (1¢)
 *   get_rankings(tour?)     — Tennis rankings    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TourInput { tour?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis'

function getTour(tour?: string): string {
  return tour === 'wta' ? 'wta' : 'atp'
}

async function tennisFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN Tennis API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tennis',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Tennis Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Tennis Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: TourInput) => {
  const tour = getTour(args.tour)
  const data = await tennisFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; winner: boolean }> }> }> }>(`/${tour}/scoreboard`)
  return {
    tour: tour.toUpperCase(),
    count: data.events?.length || 0,
    matches: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      player1: e.competitions?.[0]?.competitors?.[0]?.athlete?.displayName,
      player2: e.competitions?.[0]?.competitors?.[1]?.athlete?.displayName,
      score1: e.competitions?.[0]?.competitors?.[0]?.score,
      score2: e.competitions?.[0]?.competitors?.[1]?.score,
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async (args: TourInput) => {
  const tour = getTour(args.tour)
  const data = await tennisFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } }; record: { displayValue: string }; stats: Array<{ displayValue: string }> }> }> | null }>(`/${tour}/rankings`)
  const ranking = data.rankings?.[0]
  return {
    tour: tour.toUpperCase(),
    name: ranking?.name,
    players: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
      record: r.record?.displayValue,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-tennis MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
