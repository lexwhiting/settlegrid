/**
 * settlegrid-worldtime — World Time API MCP Server
 *
 * Wraps the World Time API API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_by_timezone(area, location)          (1¢)
 *   get_by_ip(ip)                            (1¢)
 *   list_timezones()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetByTimezoneInput {
  area: string
  location: string
}

interface GetByIpInput {
  ip: string
}

interface ListTimezonesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://worldtimeapi.org/api'
const USER_AGENT = 'settlegrid-worldtime/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Time API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'worldtime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_by_timezone: { costCents: 1, displayName: 'Get current time for a timezone' },
      get_by_ip: { costCents: 1, displayName: 'Get current time based on IP address' },
      list_timezones: { costCents: 1, displayName: 'List all available timezones' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getByTimezone = sg.wrap(async (args: GetByTimezoneInput) => {
  if (!args.area || typeof args.area !== 'string') {
    throw new Error('area is required (timezone area (e.g. america))')
  }
  if (!args.location || typeof args.location !== 'string') {
    throw new Error('location is required (timezone location (e.g. new_york))')
  }

  const params: Record<string, string> = {}
  params['area'] = String(args.area)
  params['location'] = String(args.location)

  const data = await apiFetch<Record<string, unknown>>(`/timezone/${encodeURIComponent(String(args.area))}/${encodeURIComponent(String(args.location))}`, {
    params,
  })

  return data
}, { method: 'get_by_timezone' })

const getByIp = sg.wrap(async (args: GetByIpInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (ip address)')
  }

  const params: Record<string, string> = {}
  params['ip'] = String(args.ip)

  const data = await apiFetch<Record<string, unknown>>(`/ip/${encodeURIComponent(String(args.ip))}`, {
    params,
  })

  return data
}, { method: 'get_by_ip' })

const listTimezones = sg.wrap(async (args: ListTimezonesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/timezone', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'list_timezones' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getByTimezone, getByIp, listTimezones }

console.log('settlegrid-worldtime MCP server ready')
console.log('Methods: get_by_timezone, get_by_ip, list_timezones')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
