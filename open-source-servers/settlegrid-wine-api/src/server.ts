/**
 * settlegrid-wine-api — Wine API MCP Server
 *
 * Wine database with varieties including reds, whites, sparkling, and dessert wines.
 *
 * Methods:
 *   list_reds()                   — Get list of red wines  (1¢)
 *   list_whites()                 — Get list of white wines  (1¢)
 *   list_sparkling()              — Get list of sparkling wines  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListRedsInput {

}

interface ListWhitesInput {

}

interface ListSparklingInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.sampleapis.com/wines'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wine-api/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wine API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wine-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_reds: { costCents: 1, displayName: 'List Reds' },
      list_whites: { costCents: 1, displayName: 'List Whites' },
      list_sparkling: { costCents: 1, displayName: 'List Sparkling' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listReds = sg.wrap(async (args: ListRedsInput) => {

  const data = await apiFetch<any>(`/reds`)
  return {
    id: data.id,
    wine: data.wine,
    winery: data.winery,
    rating: data.rating,
    location: data.location,
  }
}, { method: 'list_reds' })

const listWhites = sg.wrap(async (args: ListWhitesInput) => {

  const data = await apiFetch<any>(`/whites`)
  return {
    id: data.id,
    wine: data.wine,
    winery: data.winery,
    rating: data.rating,
    location: data.location,
  }
}, { method: 'list_whites' })

const listSparkling = sg.wrap(async (args: ListSparklingInput) => {

  const data = await apiFetch<any>(`/sparkling`)
  return {
    id: data.id,
    wine: data.wine,
    winery: data.winery,
    rating: data.rating,
    location: data.location,
  }
}, { method: 'list_sparkling' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listReds, listWhites, listSparkling }

console.log('settlegrid-wine-api MCP server ready')
console.log('Methods: list_reds, list_whites, list_sparkling')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
