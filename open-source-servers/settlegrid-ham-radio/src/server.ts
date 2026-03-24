/**
 * settlegrid-ham-radio — Ham Radio Callsign Lookup MCP Server
 * Wraps the Callook API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CallsignResult {
  status: string
  type: string
  current: {
    callsign: string
    operClass: string
  }
  previous: {
    callsign: string
    operClass: string
  }
  name: string
  address: {
    line1: string
    line2: string
    attn: string
  }
  location: {
    latitude: string
    longitude: string
    gridsquare: string
  }
  otherInfo: {
    grantDate: string
    expiryDate: string
    lastActionDate: string
    frn: string
    ulsUrl: string
  }
}

interface DxccEntity {
  status: string
  name: string
  dxcc: number
  cqzone: number
  ituzone: number
  continent: string
  prefix: string
  utc_offset: number
}

interface SearchResult {
  callsign: string
  name: string
  operClass: string
  state: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://callook.info'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Callook API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateCallsign(cs: string): string {
  const upper = cs.trim().toUpperCase()
  if (!upper || upper.length < 3 || upper.length > 10) {
    throw new Error('Callsign must be between 3 and 10 characters')
  }
  if (!/^[A-Z0-9\/]+$/.test(upper)) {
    throw new Error('Callsign contains invalid characters')
  }
  return upper
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed || trimmed.length < 2) throw new Error('Query must be at least 2 characters')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ham-radio' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function lookup_callsign(callsign: string): Promise<CallsignResult> {
  const cs = validateCallsign(callsign)
  return sg.wrap('lookup_callsign', async () => {
    return fetchJSON<CallsignResult>(`${API}/${cs}/json`)
  })
}

export async function search_callsigns(query: string): Promise<SearchResult[]> {
  const q = validateQuery(query)
  return sg.wrap('search_callsigns', async () => {
    const data = await fetchJSON<{ results: SearchResult[] }>(`${API}/search/${encodeURIComponent(q)}/json`)
    return data.results || []
  })
}

export async function get_dxcc(entity: string): Promise<DxccEntity> {
  const e = entity.trim()
  if (!e) throw new Error('DXCC entity number or prefix is required')
  return sg.wrap('get_dxcc', async () => {
    return fetchJSON<DxccEntity>(`${API}/dxcc/${encodeURIComponent(e)}/json`)
  })
}

console.log('settlegrid-ham-radio MCP server loaded')
