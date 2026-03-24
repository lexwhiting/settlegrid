/**
 * settlegrid-cycling — Cycling Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — Race results     (1¢)
 *   get_rankings()     — UCI rankings     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/racing/cycling'

async function cyclingFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN Cycling API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cycling',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Cycling Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Cycling Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await cyclingFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; status: { displayValue: string } }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    races: (data.events || []).slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      results: (e.competitions?.[0]?.competitors || []).slice(0, 15).map((c) => ({
        rider: c.athlete?.displayName,
        result: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await cyclingFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } } }> }> | null }>('/rankings')
  const ranking = data.rankings?.[0]
  return {
    name: ranking?.name,
    riders: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-cycling MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
