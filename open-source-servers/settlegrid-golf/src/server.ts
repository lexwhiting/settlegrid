/**
 * settlegrid-golf — Golf / PGA Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — Tournament leaderboard    (1¢)
 *   get_rankings()     — World rankings            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga'

async function golfFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN Golf API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'golf',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Golf Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Golf Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await golfFetch<{ events: Array<{ id: string; name: string; date: string; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; status: { displayValue: string } }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    tournaments: (data.events || []).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      leaderboard: (e.competitions?.[0]?.competitors || []).slice(0, 20).map((c) => ({
        player: c.athlete?.displayName,
        score: c.score,
        status: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await golfFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } }; record: { displayValue: string } }> }> | null }>('/rankings')
  const ranking = data.rankings?.[0]
  return {
    name: ranking?.name,
    players: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-golf MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
