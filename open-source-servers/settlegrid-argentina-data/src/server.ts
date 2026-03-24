/**
 * settlegrid-argentina-data — Argentine Data MCP Server
 *
 * Wraps World Bank API (ARG subset) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicators(indicator)              — Get indicator data (1¢)
 *   list_indicators(topic?)                — List available indicators (1¢)
 *   get_inflation_data(year?)   — Get inflation data for Argentina (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorsInput {
  indicator: string
  per_page?: number
}

interface ListIndicatorsInput {
  topic?: string
  per_page?: number
}

interface GetInflationDataInput {
  year?: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'ARG'
const USER_AGENT = 'settlegrid-argentina-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
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
  const res = await fetch(url.toString(), { method: options.method ?? 'GET', headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'argentina-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'Get indicator data for Argentine' },
      list_indicators: { costCents: 1, displayName: 'List available indicators' },
      get_inflation_data: { costCents: 1, displayName: 'Get inflation data for Argentina' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async (args: GetIndicatorsInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. NY.GDP.MKTP.CD)')
  }
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  const data = await apiFetch<unknown[]>(`/country/${COUNTRY}/indicator/${args.indicator}`, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicators' })

const listIndicators = sg.wrap(async (args: ListIndicatorsInput) => {
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  let path = '/indicator'
  if (args.topic) path = `/topic/${args.topic}/indicator`
  const data = await apiFetch<unknown[]>(path, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], indicators: data[1] } : data
}, { method: 'list_indicators' })

const getInflationData = sg.wrap(async (args: GetInflationDataInput) => {
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  if (args.year) params['date'] = args.year
  const data = await apiFetch<unknown[]>(`/country/${COUNTRY}/indicator/FP.CPI.TOTL.ZG`, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_inflation_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, listIndicators, getInflationData }

console.log('settlegrid-argentina-data MCP server ready')
console.log('Methods: get_indicators, list_indicators, get_inflation_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
