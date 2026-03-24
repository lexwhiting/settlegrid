/**
 * settlegrid-brazil-ibge — Brazil IBGE MCP Server
 *
 * Wraps the Brazil IBGE API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_states()                             (1¢)
 *   get_news()                               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStatesInput {
}

interface GetNewsInput {
  qtd?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://servicodados.ibge.gov.br/api/v1'
const USER_AGENT = 'settlegrid-brazil-ibge/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Brazil IBGE API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'brazil-ibge',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_states: { costCents: 1, displayName: 'Get list of Brazilian states' },
      get_news: { costCents: 1, displayName: 'Get latest IBGE news/statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStates = sg.wrap(async (args: GetStatesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/localidades/estados', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_states' })

const getNews = sg.wrap(async (args: GetNewsInput) => {

  const params: Record<string, string> = {}
  if (args.qtd !== undefined) params['qtd'] = String(args.qtd)

  const data = await apiFetch<Record<string, unknown>>('/noticias', {
    params,
  })

  return data
}, { method: 'get_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStates, getNews }

console.log('settlegrid-brazil-ibge MCP server ready')
console.log('Methods: get_states, get_news')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
