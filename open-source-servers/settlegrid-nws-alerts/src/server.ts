/**
 * settlegrid-nws-alerts — NWS Alerts MCP Server
 *
 * Wraps the NWS Alerts API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_active_alerts(area)                  (1¢)
 *   get_alert_types()                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetActiveAlertsInput {
  area: string
}

interface GetAlertTypesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weather.gov'
const USER_AGENT = 'settlegrid-nws-alerts/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`NWS Alerts API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nws-alerts',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_active_alerts: { costCents: 1, displayName: 'Get all active weather alerts for a state' },
      get_alert_types: { costCents: 1, displayName: 'Get all alert types and counts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getActiveAlerts = sg.wrap(async (args: GetActiveAlertsInput) => {
  if (!args.area || typeof args.area !== 'string') {
    throw new Error('area is required (2-letter state code (e.g. ca, tx))')
  }

  const params: Record<string, string> = {}
  params['area'] = args.area

  const data = await apiFetch<Record<string, unknown>>('/alerts/active', {
    params,
  })

  return data
}, { method: 'get_active_alerts' })

const getAlertTypes = sg.wrap(async (args: GetAlertTypesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/alerts/types', {
    params,
  })

  return data
}, { method: 'get_alert_types' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getActiveAlerts, getAlertTypes }

console.log('settlegrid-nws-alerts MCP server ready')
console.log('Methods: get_active_alerts, get_alert_types')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
