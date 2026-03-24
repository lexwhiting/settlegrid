/**
 * settlegrid-eventbrite — Eventbrite MCP Server
 *
 * Search and discover events via the Eventbrite API.
 *
 * Methods:
 *   search_events(q, location)    — Search events by keyword and location  (2¢)
 *   get_event(id)                 — Get event details by ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchEventsInput {
  q: string
  location?: string
}

interface GetEventInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.eventbriteapi.com/v3'
const API_KEY = process.env.EVENTBRITE_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-eventbrite/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Eventbrite API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'eventbrite',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_events: { costCents: 2, displayName: 'Search Events' },
      get_event: { costCents: 2, displayName: 'Get Event' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchEvents = sg.wrap(async (args: SearchEventsInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const location = typeof args.location === 'string' ? args.location.trim() : ''
  const data = await apiFetch<any>(`/events/search/?q=${encodeURIComponent(q)}&location.address=${encodeURIComponent(location)}`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.url,
        start: item.start,
        venue_id: item.venue_id,
        description: item.description,
    })),
  }
}, { method: 'search_events' })

const getEvent = sg.wrap(async (args: GetEventInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/events/${encodeURIComponent(id)}/`)
  return {
    id: data.id,
    name: data.name,
    url: data.url,
    start: data.start,
    end: data.end,
    description: data.description,
    venue_id: data.venue_id,
    category_id: data.category_id,
  }
}, { method: 'get_event' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchEvents, getEvent }

console.log('settlegrid-eventbrite MCP server ready')
console.log('Methods: search_events, get_event')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
