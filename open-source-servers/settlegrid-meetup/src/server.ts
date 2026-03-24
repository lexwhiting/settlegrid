/**
 * settlegrid-meetup — Meetup MCP Server
 *
 * Find upcoming Meetup events by topic and location.
 *
 * Methods:
 *   find_events(query, lat, lon)  — Find upcoming events by topic  (2¢)
 *   get_group(urlname)            — Get Meetup group details by URL name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FindEventsInput {
  query: string
  lat?: string
  lon?: string
}

interface GetGroupInput {
  urlname: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.meetup.com'
const API_KEY = process.env.MEETUP_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-meetup/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Meetup API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'meetup',
  pricing: {
    defaultCostCents: 2,
    methods: {
      find_events: { costCents: 2, displayName: 'Find Events' },
      get_group: { costCents: 2, displayName: 'Get Group' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const findEvents = sg.wrap(async (args: FindEventsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const lat = typeof args.lat === 'string' ? args.lat.trim() : ''
  const lon = typeof args.lon === 'string' ? args.lon.trim() : ''
  const data = await apiFetch<any>(`/find/upcoming_events?text=${encodeURIComponent(query)}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        link: item.link,
        local_date: item.local_date,
        local_time: item.local_time,
        group: item.group,
    })),
  }
}, { method: 'find_events' })

const getGroup = sg.wrap(async (args: GetGroupInput) => {
  if (!args.urlname || typeof args.urlname !== 'string') throw new Error('urlname is required')
  const urlname = args.urlname.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(urlname)}`)
  return {
    id: data.id,
    name: data.name,
    link: data.link,
    members: data.members,
    city: data.city,
    description: data.description,
  }
}, { method: 'get_group' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { findEvents, getGroup }

console.log('settlegrid-meetup MCP server ready')
console.log('Methods: find_events, get_group')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
