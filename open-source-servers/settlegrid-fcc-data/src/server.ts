/**
 * settlegrid-fcc-data — FCC License Data MCP Server
 *
 * Wraps FCC ULS API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_fcc_licenses(query) — search licenses (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

const API_BASE = 'https://data.fcc.gov/api/license-view'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fcc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_fcc_licenses: { costCents: 1, displayName: 'Search Licenses' },
    },
  },
})

const searchFccLicenses = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(`/basicSearch/getLicenses?searchValue=${encodeURIComponent(args.query)}&format=json`)
  const licenses = data.Licenses?.License || []
  const list = Array.isArray(licenses) ? licenses : [licenses]
  return {
    total: data.Licenses?.totalRows,
    licenses: list.slice(0, 20).map((l: any) => ({
      callSign: l.callSign, status: l.statusDesc, service: l.serviceDesc,
      licensee: l.licName, frn: l.frn, grant_date: l.grantDate,
      expiration_date: l.expiredDate, category: l.categoryDesc,
    })),
  }
}, { method: 'search_fcc_licenses' })

export { searchFccLicenses }

console.log('settlegrid-fcc-data MCP server ready')
console.log('Methods: search_fcc_licenses')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
