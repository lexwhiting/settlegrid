/**
 * settlegrid-open-notify — ISS Tracker MCP Server
 *
 * Wraps the Open Notify API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_iss_position()     — Current ISS coordinates   (1¢)
 *   get_people_in_space()  — People currently in space  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IssPositionResponse {
  message: string
  iss_position: { latitude: string; longitude: string }
  timestamp: number
}

interface PeopleResponse {
  message: string
  number: number
  people: Array<{ name: string; craft: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://api.open-notify.org'

async function notifyFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Notify API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-notify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_iss_position: { costCents: 1, displayName: 'ISS Position' },
      get_people_in_space: { costCents: 1, displayName: 'People in Space' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIssPosition = sg.wrap(async () => {
  const data = await notifyFetch<IssPositionResponse>('/iss-now.json')
  return {
    latitude: parseFloat(data.iss_position.latitude),
    longitude: parseFloat(data.iss_position.longitude),
    timestamp: data.timestamp,
    timestampISO: new Date(data.timestamp * 1000).toISOString(),
  }
}, { method: 'get_iss_position' })

const getPeopleInSpace = sg.wrap(async () => {
  const data = await notifyFetch<PeopleResponse>('/astros.json')
  return {
    count: data.number,
    people: data.people.map((p) => ({
      name: p.name,
      craft: p.craft,
    })),
  }
}, { method: 'get_people_in_space' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIssPosition, getPeopleInSpace }

console.log('settlegrid-open-notify MCP server ready')
console.log('Methods: get_iss_position, get_people_in_space')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
