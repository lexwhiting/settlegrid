/**
 * settlegrid-oecd-education — OECD Education Statistics MCP Server
 *
 * Wraps the OECD SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, country?)     — Get education data (2\u00A2)
 *   search_datasets(query)          — Search datasets (1\u00A2)
 *   list_countries()                — List OECD countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  country?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.oecd.org/public/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-oecd-education/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OECD API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-education',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get OECD education data' },
      search_datasets: { costCents: 1, displayName: 'Search education datasets' },
      list_countries: { costCents: 1, displayName: 'List OECD member countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. EDU_ENRL_AGE)')
  }
  const key = args.country ? args.country.toUpperCase() : 'all'
  return apiFetch<unknown>(`/data/OECD.EDU,DSD_EDU@${encodeURIComponent(args.dataset)},1.0/${key}?lastNObservations=10`)
}, { method: 'get_data' })

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/dataflow/OECD.EDU?detail=allstubs')
}, { method: 'search_datasets' })

const listCountries = sg.wrap(async () => {
  return {
    countries: [
      'AUS','AUT','BEL','CAN','CHL','COL','CRI','CZE','DNK','EST',
      'FIN','FRA','DEU','GRC','HUN','ISL','IRL','ISR','ITA','JPN',
      'KOR','LVA','LTU','LUX','MEX','NLD','NZL','NOR','POL','PRT',
      'SVK','SVN','ESP','SWE','CHE','TUR','GBR','USA',
    ],
    description: 'OECD member country ISO3 codes',
  }
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, searchDatasets, listCountries }

console.log('settlegrid-oecd-education MCP server ready')
console.log('Methods: get_data, search_datasets, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
