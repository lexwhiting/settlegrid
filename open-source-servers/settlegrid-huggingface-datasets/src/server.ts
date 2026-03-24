/**
 * settlegrid-huggingface-datasets — Hugging Face Datasets MCP Server
 *
 * Search and browse ML datasets on Hugging Face Hub.
 *
 * Methods:
 *   search_datasets(query, limit) — Search Hugging Face datasets by keyword  (1¢)
 *   get_dataset(dataset_id)       — Get details about a specific dataset  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  dataset_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://huggingface.co/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-huggingface-datasets/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Hugging Face Datasets API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'huggingface-datasets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const limit = typeof args.limit === 'number' ? args.limit : 0
  const data = await apiFetch<any>(`/datasets?search=${encodeURIComponent(query)}&limit=${limit}`)
  return {
    id: data.id,
    description: data.description,
    downloads: data.downloads,
    likes: data.likes,
    tags: data.tags,
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.dataset_id || typeof args.dataset_id !== 'string') throw new Error('dataset_id is required')
  const dataset_id = args.dataset_id.trim()
  const data = await apiFetch<any>(`/datasets/${encodeURIComponent(dataset_id)}`)
  return {
    id: data.id,
    description: data.description,
    citation: data.citation,
    downloads: data.downloads,
    likes: data.likes,
    tags: data.tags,
    cardData: data.cardData,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-huggingface-datasets MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
