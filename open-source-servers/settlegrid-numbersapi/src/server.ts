/**
 * settlegrid-numbersapi — Numbers API MCP Server
 *
 * Wraps the Numbers API API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_number_fact(number)                  (1¢)
 *   get_date_fact(month, day)                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetNumberFactInput {
  number: number
}

interface GetDateFactInput {
  month: number
  day: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://numbersapi.com'
const USER_AGENT = 'settlegrid-numbersapi/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Numbers API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'numbersapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_number_fact: { costCents: 1, displayName: 'Get a fact about a number' },
      get_date_fact: { costCents: 1, displayName: 'Get a fact about a date' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getNumberFact = sg.wrap(async (args: GetNumberFactInput) => {
  if (typeof args.number !== 'number' || isNaN(args.number)) {
    throw new Error('number must be a number')
  }

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.number))}`, {
    params,
  })

  return data
}, { method: 'get_number_fact' })

const getDateFact = sg.wrap(async (args: GetDateFactInput) => {
  if (typeof args.month !== 'number' || isNaN(args.month)) {
    throw new Error('month must be a number')
  }
  if (typeof args.day !== 'number' || isNaN(args.day)) {
    throw new Error('day must be a number')
  }

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.month))}/${encodeURIComponent(String(args.day))}/date`, {
    params,
  })

  return data
}, { method: 'get_date_fact' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getNumberFact, getDateFact }

console.log('settlegrid-numbersapi MCP server ready')
console.log('Methods: get_number_fact, get_date_fact')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
