/**
 * settlegrid-insurance-rates — Insurance & Provider Data MCP Server
 * Wraps CMS Provider Data API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PlanResult {
  id: string
  name: string
  state: string
  type: string
  issuer: string
  premium: number
  deductible: number
}

interface ProviderStats {
  state: string
  totalProviders: number
  totalHospitals: number
  avgRating: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://data.cms.gov/provider-data/api/1'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CMS API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'insurance-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPlans(state: string, type?: string): Promise<PlanResult[]> {
  if (!state || state.length !== 2) throw new Error('Valid US state abbreviation required (e.g., CA, NY)')
  return sg.wrap('search_plans', async () => {
    const data = await fetchJSON<any>(
      `${API}/datasets/xdqk-h42a/data?filter[state]=${state.toUpperCase()}&size=20`
    )
    let results = (data || []).map((d: any) => ({
      id: d.provider_id || d.enrollment_id || String(Math.random()),
      name: d.provider_name || d.plan_name || '',
      state: d.state || state, type: d.provider_type || type || 'medical',
      issuer: d.organization_name || '', premium: 0, deductible: 0,
    }))
    if (type) results = results.filter((r: PlanResult) => r.type.toLowerCase().includes(type.toLowerCase()))
    return results.slice(0, 20)
  })
}

async function getPlan(id: string): Promise<PlanResult> {
  if (!id) throw new Error('Plan ID is required')
  return sg.wrap('get_plan', async () => {
    const data = await fetchJSON<any>(`${API}/datasets/xdqk-h42a/data?filter[provider_id]=${encodeURIComponent(id)}`)
    const d = Array.isArray(data) ? data[0] : data
    if (!d) throw new Error(`No plan found with ID ${id}`)
    return {
      id: d.provider_id || id, name: d.provider_name || '',
      state: d.state || '', type: d.provider_type || '',
      issuer: d.organization_name || '', premium: 0, deductible: 0,
    }
  })
}

async function getStats(state: string): Promise<ProviderStats> {
  if (!state || state.length !== 2) throw new Error('Valid US state abbreviation required')
  return sg.wrap('get_stats', async () => {
    const data = await fetchJSON<any>(
      `${API}/datasets/xdqk-h42a/data?filter[state]=${state.toUpperCase()}&size=100`
    )
    const providers = Array.isArray(data) ? data : []
    const ratings = providers.filter((p: any) => p.rating).map((p: any) => parseFloat(p.rating))
    return {
      state: state.toUpperCase(),
      totalProviders: providers.length,
      totalHospitals: providers.filter((p: any) => p.provider_type?.includes('Hospital')).length,
      avgRating: ratings.length ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 100) / 100 : 0,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPlans, getPlan, getStats }
console.log('settlegrid-insurance-rates server started')
