/**
 * settlegrid-cat-facts — Cat Facts MCP Server
 *
 * Wraps CatFact.ninja API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_cat_fact() — random cat fact (1¢)
 *   list_cat_breeds(limit?) — cat breeds (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BreedInput { limit?: number }

const API_BASE = 'https://catfact.ninja'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'cat-facts',
  pricing: { defaultCostCents: 1, methods: { get_cat_fact: { costCents: 1, displayName: 'Cat Fact' }, list_cat_breeds: { costCents: 1, displayName: 'Cat Breeds' } } },
})

const getCatFact = sg.wrap(async () => {
  const data = await apiFetch<any>('/fact')
  return { fact: data.fact, length: data.length }
}, { method: 'get_cat_fact' })

const listCatBreeds = sg.wrap(async (args: BreedInput) => {
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`/breeds?limit=${limit}`)
  return {
    total: data.total,
    breeds: (data.data || []).map((b: any) => ({
      breed: b.breed, country: b.country, origin: b.origin, coat: b.coat, pattern: b.pattern,
    })),
  }
}, { method: 'list_cat_breeds' })

export { getCatFact, listCatBreeds }

console.log('settlegrid-cat-facts MCP server ready')
console.log('Methods: get_cat_fact, list_cat_breeds')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
