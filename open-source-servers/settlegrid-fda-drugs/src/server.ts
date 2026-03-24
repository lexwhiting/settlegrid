/**
 * settlegrid-fda-drugs — FDA Drug Data MCP Server
 *
 * Wraps openFDA Drug API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_drugs(query, limit?) — search drugs (1¢)
 *   get_adverse_events(drug_name, limit?) — adverse events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface EventInput { drug_name: string; limit?: number }

const API_BASE = 'https://api.fda.gov/drug'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fda-drugs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_drugs: { costCents: 1, displayName: 'Search Drugs' },
      get_adverse_events: { costCents: 1, displayName: 'Adverse Events' },
    },
  },
})

const searchDrugs = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`/label.json?search=openfda.brand_name:"${encodeURIComponent(args.query)}"&limit=${limit}`)
  return {
    total: data.meta?.results?.total,
    drugs: (data.results || []).map((d: any) => ({
      brand_name: d.openfda?.brand_name?.[0], generic_name: d.openfda?.generic_name?.[0],
      manufacturer: d.openfda?.manufacturer_name?.[0], route: d.openfda?.route?.[0],
      substance: d.openfda?.substance_name?.[0],
      purpose: d.purpose?.[0]?.slice(0, 200),
      warnings: d.warnings?.[0]?.slice(0, 200),
    })),
  }
}, { method: 'search_drugs' })

const getAdverseEvents = sg.wrap(async (args: EventInput) => {
  if (!args.drug_name) throw new Error('drug_name is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`/event.json?search=patient.drug.openfda.brand_name:"${encodeURIComponent(args.drug_name)}"&limit=${limit}`)
  return {
    total: data.meta?.results?.total,
    events: (data.results || []).map((e: any) => ({
      date: e.receivedate, serious: e.serious, country: e.occurcountry,
      reactions: e.patient?.reaction?.map((r: any) => r.reactionmeddrapt)?.slice(0, 5),
      outcome: e.patient?.reaction?.[0]?.reactionoutcome,
    })),
  }
}, { method: 'get_adverse_events' })

export { searchDrugs, getAdverseEvents }

console.log('settlegrid-fda-drugs MCP server ready')
console.log('Methods: search_drugs, get_adverse_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
