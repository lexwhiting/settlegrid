/**
 * settlegrid-ufc-data — UFC / MMA Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — UFC events/results    (1¢)
 *   get_rankings()     — Fighter rankings      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

async function ufcFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN UFC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ufc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'UFC Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'UFC Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await ufcFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; winner: boolean }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      fights: (e.competitions || []).slice(0, 5).map((c) => ({
        fighter1: c.competitors?.[0]?.athlete?.displayName,
        fighter2: c.competitors?.[1]?.athlete?.displayName,
        score1: c.competitors?.[0]?.score,
        score2: c.competitors?.[1]?.score,
        winner: c.competitors?.find((f) => f.winner)?.athlete?.displayName,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await ufcFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string }; record: { displayValue: string } }> }> | null }>('/rankings')
  return {
    divisions: (data.rankings || []).map((d) => ({
      division: d.name,
      fighters: (d.ranks || []).slice(0, 15).map((r) => ({
        rank: r.current,
        name: r.athlete?.displayName,
        record: r.record?.displayValue,
      })),
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-ufc-data MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
