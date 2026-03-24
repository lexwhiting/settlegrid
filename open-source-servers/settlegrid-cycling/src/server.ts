/**
 * settlegrid-cycling — Cycling MCP Server
 *
 * Professional cycling race results and rankings via ESPN.
 *
 * Methods:
 *   get_scoreboard()              — Get current cycling event scores  (1¢)
 *   get_event(event_id)           — Get cycling event details  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreboardInput {

}

interface GetEventInput {
  event_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/cycling'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-cycling/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cycling API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cycling',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_event: { costCents: 1, displayName: 'Get Event' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {

  const data = await apiFetch<any>(`/scoreboard`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        status: item.status,
    })),
  }
}, { method: 'get_scoreboard' })

const getEvent = sg.wrap(async (args: GetEventInput) => {
  if (!args.event_id || typeof args.event_id !== 'string') throw new Error('event_id is required')
  const event_id = args.event_id.trim()
  const data = await apiFetch<any>(`/summary?event=${encodeURIComponent(event_id)}`)
  return {
    id: data.id,
    name: data.name,
    date: data.date,
    competitions: data.competitions,
  }
}, { method: 'get_event' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getEvent }

console.log('settlegrid-cycling MCP server ready')
console.log('Methods: get_scoreboard, get_event')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
