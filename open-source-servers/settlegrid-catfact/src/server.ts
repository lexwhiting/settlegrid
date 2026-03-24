/**
 * settlegrid-catfact — Cat Facts MCP Server
 *
 * Methods:
 *   get_fact()            — Random cat fact    (1¢)
 *   get_facts(limit?)     — List cat facts     (1¢)
 *   get_breeds(limit?)    — List cat breeds    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput { limit?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://catfact.ninja'

async function catFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cat Fact API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'catfact',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_fact: { costCents: 1, displayName: 'Random Cat Fact' },
      get_facts: { costCents: 1, displayName: 'Cat Facts List' },
      get_breeds: { costCents: 1, displayName: 'Cat Breeds' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFact = sg.wrap(async () => {
  const data = await catFetch<{ fact: string; length: number }>('/fact')
  return { fact: data.fact, length: data.length }
}, { method: 'get_fact' })

const getFacts = sg.wrap(async (args: ListInput) => {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const data = await catFetch<{ data: Array<{ fact: string; length: number }> }>(`/facts?limit=${limit}`)
  return { count: data.data.length, facts: data.data }
}, { method: 'get_facts' })

const getBreeds = sg.wrap(async (args: ListInput) => {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const data = await catFetch<{ data: Array<{ breed: string; country: string; origin: string; coat: string; pattern: string }> }>(`/breeds?limit=${limit}`)
  return { count: data.data.length, breeds: data.data }
}, { method: 'get_breeds' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFact, getFacts, getBreeds }

console.log('settlegrid-catfact MCP server ready')
console.log('Methods: get_fact, get_facts, get_breeds')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
