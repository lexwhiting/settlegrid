/**
 * settlegrid-drugs-fda — Drugs FDA MCP Server
 *
 * FDA drug labeling, adverse events, and recall data via openFDA.
 *
 * Methods:
 *   search_labels(query)          — Search drug labels by brand or generic name  (1¢)
 *   search_adverse_events(drug_name) — Search drug adverse event reports  (1¢)
 *   search_recalls(query)         — Search drug recall enforcement reports  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchLabelsInput {
  query: string
}

interface SearchAdverseEventsInput {
  drug_name: string
}

interface SearchRecallsInput {
  query?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.fda.gov/drug'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-drugs-fda/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drugs FDA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'drugs-fda',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_labels: { costCents: 1, displayName: 'Search Labels' },
      search_adverse_events: { costCents: 1, displayName: 'Search Adverse Events' },
      search_recalls: { costCents: 1, displayName: 'Search Recalls' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchLabels = sg.wrap(async (args: SearchLabelsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        openfda.brand_name: item.openfda.brand_name,
        openfda.generic_name: item.openfda.generic_name,
        openfda.manufacturer_name: item.openfda.manufacturer_name,
        indications_and_usage: item.indications_and_usage,
    })),
  }
}, { method: 'search_labels' })

const searchAdverseEvents = sg.wrap(async (args: SearchAdverseEventsInput) => {
  if (!args.drug_name || typeof args.drug_name !== 'string') throw new Error('drug_name is required')
  const drug_name = args.drug_name.trim()
  const data = await apiFetch<any>(`/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug_name)}"&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        receivedate: item.receivedate,
        serious: item.serious,
        patient.drug: item.patient.drug,
        patient.reaction: item.patient.reaction,
    })),
  }
}, { method: 'search_adverse_events' })

const searchRecalls = sg.wrap(async (args: SearchRecallsInput) => {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const data = await apiFetch<any>(`/enforcement.json?search=reason_for_recall:"${encodeURIComponent(query)}"&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        recall_number: item.recall_number,
        reason_for_recall: item.reason_for_recall,
        product_description: item.product_description,
        status: item.status,
        classification: item.classification,
    })),
  }
}, { method: 'search_recalls' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchLabels, searchAdverseEvents, searchRecalls }

console.log('settlegrid-drugs-fda MCP server ready')
console.log('Methods: search_labels, search_adverse_events, search_recalls')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
