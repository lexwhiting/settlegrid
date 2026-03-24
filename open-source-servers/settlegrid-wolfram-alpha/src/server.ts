/**
 * settlegrid-wolfram-alpha — Wolfram Alpha MCP Server
 *
 * Computational knowledge engine — math, science, data.
 *
 * Methods:
 *   query(input)                  — Ask Wolfram Alpha a computational question (short answer)  (3¢)
 *   full_query(input)             — Ask Wolfram Alpha with full structured results  (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QueryInput {
  input: string
}

interface FullQueryInput {
  input: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.wolframalpha.com/v1'
const API_KEY = process.env.WOLFRAM_APP_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wolfram-alpha/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wolfram Alpha API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wolfram-alpha',
  pricing: {
    defaultCostCents: 3,
    methods: {
      query: { costCents: 3, displayName: 'Query' },
      full_query: { costCents: 3, displayName: 'Full Query' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const query = sg.wrap(async (args: QueryInput) => {
  if (!args.input || typeof args.input !== 'string') throw new Error('input is required')
  const input = args.input.trim()
  const data = await apiFetch<any>(`/result?i=${encodeURIComponent(input)}&output=JSON&appid=${API_KEY}`)
  return {
    queryresult: data.queryresult,
  }
}, { method: 'query' })

const fullQuery = sg.wrap(async (args: FullQueryInput) => {
  if (!args.input || typeof args.input !== 'string') throw new Error('input is required')
  const input = args.input.trim()
  const data = await apiFetch<any>(`/result?i=${encodeURIComponent(input)}&output=JSON&podstate=Step-by-step+solution&appid=${API_KEY}`)
  return {
    queryresult: data.queryresult,
  }
}, { method: 'full_query' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { query, fullQuery }

console.log('settlegrid-wolfram-alpha MCP server ready')
console.log('Methods: query, full_query')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
