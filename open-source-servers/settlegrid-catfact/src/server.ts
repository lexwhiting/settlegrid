/**
 * settlegrid-catfact — Cat Facts MCP Server
 *
 * Get random cat facts from the Cat Fact API.
 *
 * Methods:
 *   get_fact()                    — Get a random cat fact  (1¢)
 *   get_breeds()                  — List cat breeds  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFactInput {

}

interface GetBreedsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://catfact.ninja'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-catfact/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cat Facts API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'catfact',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_fact: { costCents: 1, displayName: 'Random Fact' },
      get_breeds: { costCents: 1, displayName: 'Get Breeds' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFact = sg.wrap(async (args: GetFactInput) => {

  const data = await apiFetch<any>(`/fact`)
  return {
    fact: data.fact,
    length: data.length,
  }
}, { method: 'get_fact' })

const getBreeds = sg.wrap(async (args: GetBreedsInput) => {

  const data = await apiFetch<any>(`/breeds?limit=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        breed: item.breed,
        country: item.country,
        origin: item.origin,
        coat: item.coat,
        pattern: item.pattern,
    })),
  }
}, { method: 'get_breeds' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFact, getBreeds }

console.log('settlegrid-catfact MCP server ready')
console.log('Methods: get_fact, get_breeds')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
