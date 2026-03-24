/**
 * settlegrid-uk-nhs — NHS Health Data MCP Server
 *
 * Wraps NHS Conditions API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_conditions(query)               — Search health conditions (1¢)
 *   get_condition(slug)                    — Get condition details (1¢)
 *   list_medicines(letter?)                — List medicines (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchConditionsInput {
  query: string
}

interface GetConditionInput {
  slug: string
}

interface ListMedicinesInput {
  letter?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nhs.uk'
const USER_AGENT = 'settlegrid-uk-nhs/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
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
    'subscription-key': 'none',
    ...options.headers,
  }
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NHS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-nhs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_conditions: { costCents: 1, displayName: 'Search NHS health conditions' },
      get_condition: { costCents: 1, displayName: 'Get condition details' },
      list_medicines: { costCents: 1, displayName: 'List NHS medicines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchConditions = sg.wrap(async (args: SearchConditionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/conditions', {
    params: { category: args.query },
  })
  return data
}, { method: 'search_conditions' })

const getCondition = sg.wrap(async (args: GetConditionInput) => {
  if (!args.slug || typeof args.slug !== 'string') {
    throw new Error('slug is required (e.g. diabetes)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/conditions/${encodeURIComponent(args.slug)}`)
  return data
}, { method: 'get_condition' })

const listMedicines = sg.wrap(async (args: ListMedicinesInput) => {
  const path = args.letter ? `/medicines?letter=${encodeURIComponent(args.letter)}` : '/medicines'
  const data = await apiFetch<Record<string, unknown>>(path)
  return data
}, { method: 'list_medicines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchConditions, getCondition, listMedicines }

console.log('settlegrid-uk-nhs MCP server ready')
console.log('Methods: search_conditions, get_condition, list_medicines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
