/**
 * settlegrid-oecd-environment — OECD Environment Statistics MCP Server
 *
 * Wraps the OECD SDMX API (environment) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_environment_data(indicator, country?)  — Get data (2\u00A2)
 *   list_indicators()                          — List dataflows (1\u00A2)
 *   list_countries()                           — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnvDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.oecd.org/public/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-oecd-environment/1.0',
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
  toolSlug: 'oecd-environment',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_environment_data: { costCents: 2, displayName: 'Get environment data' },
      list_indicators: { costCents: 1, displayName: 'List environment dataflows' },
      list_countries: { costCents: 1, displayName: 'List OECD countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEnvironmentData = sg.wrap(async (args: EnvDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (OECD environment dataflow ID)')
  }
  const key = args.country ? args.country.toUpperCase() : 'all'
  return apiFetch<unknown>(`/data/OECD.ENV,DSD_ENV@${encodeURIComponent(args.indicator)},1.0/${key}?lastNObservations=10`)
}, { method: 'get_environment_data' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/OECD.ENV?detail=allstubs')
}, { method: 'list_indicators' })

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

export { getEnvironmentData, listIndicators, listCountries }

console.log('settlegrid-oecd-environment MCP server ready')
console.log('Methods: get_environment_data, list_indicators, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
