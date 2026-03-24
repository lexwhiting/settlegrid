/**
 * settlegrid-forest-data — Global Forest Watch MCP Server
 *
 * Deforestation and forest cover data from Global Forest Watch.
 *
 * Methods:
 *   get_datasets()                — List available forest datasets  (1¢)
 *   get_tree_cover_loss(iso)      — Get tree cover loss statistics by ISO country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDatasetsInput {

}

interface GetTreeCoverLossInput {
  iso: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data-api.globalforestwatch.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-forest-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Global Forest Watch API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'forest-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_datasets: { costCents: 1, displayName: 'Get Datasets' },
      get_tree_cover_loss: { costCents: 1, displayName: 'Get Tree Cover Loss' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDatasets = sg.wrap(async (args: GetDatasetsInput) => {

  const data = await apiFetch<any>(`/dataset`)
  const items = (data.data ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        dataset: item.dataset,
        metadata: item.metadata,
    })),
  }
}, { method: 'get_datasets' })

const getTreeCoverLoss = sg.wrap(async (args: GetTreeCoverLossInput) => {
  if (!args.iso || typeof args.iso !== 'string') throw new Error('iso is required')
  const iso = args.iso.trim()
  const data = await apiFetch<any>(`/dataset/umd_tree_cover_loss/latest/query/iso?iso=${encodeURIComponent(iso)}`)
  const items = (data.data ?? []).slice(0, 25)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        iso: item.iso,
        year: item.year,
        area_loss: item.area_loss,
        emissions: item.emissions,
    })),
  }
}, { method: 'get_tree_cover_loss' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDatasets, getTreeCoverLoss }

console.log('settlegrid-forest-data MCP server ready')
console.log('Methods: get_datasets, get_tree_cover_loss')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
