/**
 * settlegrid-running — Running / Marathon Data MCP Server
 *
 * Methods:
 *   get_scoreboard()     — Marathon events       (1¢)
 *   get_track_events()   — Track & field         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const MARATHON_BASE = 'https://site.api.espn.com/apis/site/v2/sports/racing/marathon'
const TRACK_BASE = 'https://site.api.espn.com/apis/site/v2/sports/olympics/track-and-field'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESPN API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'running',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Running Events' },
      get_track_events: { costCents: 1, displayName: 'Track Events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await fetchJson<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; status: { displayValue: string } }> }> }> }>(`${MARATHON_BASE}/scoreboard`)
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      results: (e.competitions?.[0]?.competitors || []).slice(0, 10).map((c) => ({
        athlete: c.athlete?.displayName,
        result: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getTrackEvents = sg.wrap(async () => {
  const data = await fetchJson<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } } }> }>(`${TRACK_BASE}/scoreboard`)
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
    })),
  }
}, { method: 'get_track_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getTrackEvents }

console.log('settlegrid-running MCP server ready')
console.log('Methods: get_scoreboard, get_track_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
