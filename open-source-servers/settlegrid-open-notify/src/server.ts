/**
 * settlegrid-open-notify — Open Notify (ISS) MCP Server
 *
 * Wraps the Open Notify (ISS) API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_iss_position()                       (1¢)
 *   get_astronauts()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIssPositionInput {
}

interface GetAstronautsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://api.open-notify.org'
const USER_AGENT = 'settlegrid-open-notify/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Open Notify (ISS) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-notify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_iss_position: { costCents: 1, displayName: 'Get current ISS position' },
      get_astronauts: { costCents: 1, displayName: 'Get astronauts currently in space' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIssPosition = sg.wrap(async (args: GetIssPositionInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/iss-now.json', {
    params,
  })

  return data
}, { method: 'get_iss_position' })

const getAstronauts = sg.wrap(async (args: GetAstronautsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/astros.json', {
    params,
  })

  return data
}, { method: 'get_astronauts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIssPosition, getAstronauts }

console.log('settlegrid-open-notify MCP server ready')
console.log('Methods: get_iss_position, get_astronauts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
