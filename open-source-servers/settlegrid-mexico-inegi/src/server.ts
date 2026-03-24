/**
 * settlegrid-mexico-inegi — Mexico INEGI MCP Server
 *
 * Wraps the Mexico INEGI API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(indicatorId, token)        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  indicatorId: string
  token: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR'
const USER_AGENT = 'settlegrid-mexico-inegi/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Mexico INEGI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mexico-inegi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get economic indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.indicatorId || typeof args.indicatorId !== 'string') {
    throw new Error('indicatorId is required (inegi indicator id)')
  }
  if (!args.token || typeof args.token !== 'string') {
    throw new Error('token is required (inegi api token)')
  }

  const params: Record<string, string> = {}
  params['indicatorId'] = String(args.indicatorId)
  params['token'] = String(args.token)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.indicatorId))}/es/0700/false/BIE/2.0/${encodeURIComponent(String(args.token))}`, {
    params,
  })

  return data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator }

console.log('settlegrid-mexico-inegi MCP server ready')
console.log('Methods: get_indicator')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
