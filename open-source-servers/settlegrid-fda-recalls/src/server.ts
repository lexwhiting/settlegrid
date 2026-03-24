/**
 * settlegrid-fda-recalls — FDA Recalls MCP Server
 *
 * Wraps the openFDA API for recall data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_food_recalls(query, limit?)    — Food recalls     (1¢)
 *   search_drug_recalls(query, limit?)    — Drug recalls     (1¢)
 *   search_device_recalls(query, limit?)  — Device recalls   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecallInput { query: string; limit?: number }

interface RecallEntry {
  recall_number: string
  reason_for_recall: string
  status: string
  classification: string
  product_description: string
  recalling_firm: string
  city: string
  state: string
  country: string
  recall_initiation_date: string
  voluntary_mandated: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fda.gov'

async function fdaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('No results found')
    const body = await res.text().catch(() => '')
    throw new Error(`openFDA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatRecall(r: RecallEntry) {
  return {
    recallNumber: r.recall_number,
    reason: r.reason_for_recall?.slice(0, 500),
    status: r.status,
    classification: r.classification,
    product: r.product_description?.slice(0, 300),
    firm: r.recalling_firm,
    location: [r.city, r.state, r.country].filter(Boolean).join(', '),
    initiationDate: r.recall_initiation_date,
    voluntaryMandated: r.voluntary_mandated,
  }
}

function buildRecallSearch(category: string, query: string, limit: number) {
  const safeQuery = query.replace(/[^a-zA-Z0-9 ]/g, '').trim()
  const lim = Math.min(Math.max(limit, 1), 100)
  return `/${category}/enforcement.json?search=${encodeURIComponent(safeQuery)}&limit=${lim}`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fda-recalls',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_food_recalls: { costCents: 1, displayName: 'Food Recalls' },
      search_drug_recalls: { costCents: 1, displayName: 'Drug Recalls' },
      search_device_recalls: { costCents: 1, displayName: 'Device Recalls' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFoodRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('food', args.query, args.limit || 10))
  return { query: args.query, category: 'food', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_food_recalls' })

const searchDrugRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('drug', args.query, args.limit || 10))
  return { query: args.query, category: 'drug', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_drug_recalls' })

const searchDeviceRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('device', args.query, args.limit || 10))
  return { query: args.query, category: 'device', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_device_recalls' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFoodRecalls, searchDrugRecalls, searchDeviceRecalls }

console.log('settlegrid-fda-recalls MCP server ready')
console.log('Methods: search_food_recalls, search_drug_recalls, search_device_recalls')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
