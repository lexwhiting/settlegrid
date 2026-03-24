/**
 * settlegrid-historical-events — Historical Event Timeline MCP Server
 * Wraps Wikimedia On This Day API with SettleGrid billing.
 * Methods:
 *   get_events(month, day, type?) — Get events (1¢)
 *   get_births(month, day)        — Get births (1¢)
 *   get_deaths(month, day)        — Get deaths (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventInput {
  month: number
  day: number
  type?: string
}

interface DateInput {
  month: number
  day: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday'

async function apiFetch<T>(type: string, month: number, day: number): Promise<T> {
  const res = await fetch(`${API_BASE}/${type}/${month}/${day}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-historical-events/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wikimedia API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateDate(month: number, day: number): void {
  if (typeof month !== 'number' || month < 1 || month > 12) {
    throw new Error('month must be 1-12')
  }
  if (typeof day !== 'number' || day < 1 || day > 31) {
    throw new Error('day must be 1-31')
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'historical-events',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_events: { costCents: 1, displayName: 'Get historical events' },
      get_births: { costCents: 1, displayName: 'Get notable births' },
      get_deaths: { costCents: 1, displayName: 'Get notable deaths' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEvents = sg.wrap(async (args: EventInput) => {
  validateDate(args.month, args.day)
  const type = args.type || 'selected'
  return apiFetch<unknown>(type, args.month, args.day)
}, { method: 'get_events' })

const getBirths = sg.wrap(async (args: DateInput) => {
  validateDate(args.month, args.day)
  return apiFetch<unknown>('births', args.month, args.day)
}, { method: 'get_births' })

const getDeaths = sg.wrap(async (args: DateInput) => {
  validateDate(args.month, args.day)
  return apiFetch<unknown>('deaths', args.month, args.day)
}, { method: 'get_deaths' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getBirths, getDeaths }

console.log('settlegrid-historical-events MCP server ready')
console.log('Methods: get_events, get_births, get_deaths')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
