/**
 * settlegrid-disaster-events — Natural Disaster Events MCP Server
 *
 * Natural disaster event tracking from NASA EONET.
 *
 * Methods:
 *   get_events(category)          — Get recent natural disaster events  (1¢)
 *   get_categories()              — List available event categories  (1¢)
 *   get_event(id)                 — Get details for a specific event by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetEventsInput {
  category?: string
}

interface GetCategoriesInput {

}

interface GetEventInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://eonet.gsfc.nasa.gov/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-disaster-events/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Natural Disaster Events API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'disaster-events',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_events: { costCents: 1, displayName: 'Get Events' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
      get_event: { costCents: 1, displayName: 'Get Event' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEvents = sg.wrap(async (args: GetEventsInput) => {
  const category = typeof args.category === 'string' ? args.category.trim() : ''
  const data = await apiFetch<any>(`/events?status=open&limit=20${category ? "&category=" + category : ""}`)
  const items = (data.events ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        categories: item.categories,
        geometry: item.geometry,
        sources: item.sources,
    })),
  }
}, { method: 'get_events' })

const getCategories = sg.wrap(async (args: GetCategoriesInput) => {

  const data = await apiFetch<any>(`/categories`)
  const items = (data.categories ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        link: item.link,
    })),
  }
}, { method: 'get_categories' })

const getEvent = sg.wrap(async (args: GetEventInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/events/${encodeURIComponent(id)}`)
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    categories: data.categories,
    geometry: data.geometry,
    sources: data.sources,
  }
}, { method: 'get_event' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getCategories, getEvent }

console.log('settlegrid-disaster-events MCP server ready')
console.log('Methods: get_events, get_categories, get_event')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
