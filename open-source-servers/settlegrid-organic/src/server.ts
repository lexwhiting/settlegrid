/**
 * settlegrid-organic — Organic Certification Data MCP Server
 * Wraps the USDA Organic Integrity Database API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OrganicOperation {
  id: string
  name: string
  city: string
  state: string
  country: string
  certifier: string
  status: string
  effectiveDate: string
  scope: string[]
  items: string[]
}

interface OrganicStats {
  state: string | null
  totalOperations: number
  activeOperations: number
  surrenderedOperations: number
  revokedOperations: number
  topScopes: { scope: string; count: number }[]
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://organic.ams.usda.gov/integrity/Api'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USDA Organic API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'organic' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchOperations(name?: string, state?: string): Promise<{ operations: OrganicOperation[] }> {
  if (!name && !state) throw new Error('At least one of name or state is required')
  return sg.wrap('search_operations', async () => {
    const params = new URLSearchParams()
    if (name) params.set('name', name.trim())
    if (state) {
      const stUpper = state.trim().toUpperCase()
      if (stUpper.length !== 2) throw new Error('State must be a 2-letter abbreviation')
      params.set('state', stUpper)
    }
    const data = await fetchJSON<OrganicOperation[]>(`${API}/Search?${params}`)
    return { operations: Array.isArray(data) ? data : [] }
  })
}

async function getOperation(id: string): Promise<OrganicOperation> {
  if (!id || !id.trim()) throw new Error('Operation ID is required')
  return sg.wrap('get_operation', async () => {
    const data = await fetchJSON<OrganicOperation>(`${API}/Operation/${encodeURIComponent(id.trim())}`)
    return data
  })
}

async function getStats(state?: string): Promise<OrganicStats> {
  return sg.wrap('get_stats', async () => {
    const params = new URLSearchParams()
    if (state) {
      const stUpper = state.trim().toUpperCase()
      if (stUpper.length !== 2) throw new Error('State must be a 2-letter abbreviation')
      params.set('state', stUpper)
    }
    const data = await fetchJSON<OrganicStats>(`${API}/Stats?${params}`)
    return {
      state: state?.toUpperCase() || null,
      totalOperations: data.totalOperations || 0,
      activeOperations: data.activeOperations || 0,
      surrenderedOperations: data.surrenderedOperations || 0,
      revokedOperations: data.revokedOperations || 0,
      topScopes: data.topScopes || [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOperations, getOperation, getStats }

console.log('settlegrid-organic MCP server loaded')
