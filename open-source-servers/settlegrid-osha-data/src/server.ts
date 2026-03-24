/**
 * settlegrid-osha-data — OSHA Inspection Data MCP Server
 *
 * Wraps DOL OSHA API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_osha_inspections(establishment?, state?) — search inspections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InspInput { establishment?: string; state?: string }

const API_BASE = 'https://data.dol.gov/get'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'osha-data',
  pricing: { defaultCostCents: 1, methods: { search_osha_inspections: { costCents: 1, displayName: 'Search Inspections' } } },
})

const searchOshaInspections = sg.wrap(async (args: InspInput) => {
  let filters: string[] = []
  if (args.establishment) filters.push(`estab_name=${encodeURIComponent(args.establishment)}`)
  if (args.state) filters.push(`site_state=${args.state.toUpperCase()}`)
  const query = filters.length ? `?${filters.join('&')}&limit=20` : '?limit=20'
  const data = await apiFetch<any>(`/inspection${query}`)
  const results = Array.isArray(data) ? data : data.results || []
  return {
    inspections: results.slice(0, 20).map((r: any) => ({
      activity_nr: r.activity_nr, estab_name: r.estab_name,
      site_city: r.site_city, site_state: r.site_state,
      open_date: r.open_date, close_case_date: r.close_case_date,
      sic_code: r.sic_code, insp_type: r.insp_type,
    })),
  }
}, { method: 'search_osha_inspections' })

export { searchOshaInspections }

console.log('settlegrid-osha-data MCP server ready')
console.log('Methods: search_osha_inspections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
