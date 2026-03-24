/**
 * settlegrid-congress-bills — Congressional Bills MCP Server
 * Wraps the Congress.gov API with SettleGrid billing.
 *
 * Search and retrieve US Congressional bills, resolutions,
 * and amendments from the official Congress.gov API.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Bill {
  congress: number
  type: string
  number: number
  title: string
  originChamber: string
  updateDate: string
  url: string
  latestAction: { actionDate: string; text: string } | null
}

interface BillDetail extends Bill {
  introducedDate: string
  sponsors: { bioguideId: string; fullName: string; party: string; state: string }[]
  cosponsors: { count: number; url: string }
  committees: { url: string }
  subjects: { url: string }
  summaries: { url: string }
  policyArea: { name: string } | null
}

interface BillSearchResponse {
  bills: Bill[]
  pagination: { count: number; next: string | null }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = `${url}${separator}api_key=${API_KEY}&format=json`
  const res = await fetch(fullUrl)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Congress API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const VALID_BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']

function validateBillType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_BILL_TYPES.includes(lower)) {
    throw new Error(`Invalid bill type: ${type}. Valid: ${VALID_BILL_TYPES.join(', ')}`)
  }
  return lower
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(250, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'congress-bills',
  pricing: { defaultCostCents: 2, methods: { search_bills: 2, get_bill: 2, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchBills = sg.wrap(async (args: { query: string; congress?: number; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  let path = `/bill`
  if (args.congress) path = `/bill/${args.congress}`
  const params = new URLSearchParams({ limit: String(lim), q })
  return apiFetch<BillSearchResponse>(`${path}?${params}`)
}, { method: 'search_bills' })

const getBill = sg.wrap(async (args: { congress: number; type: string; number: number }) => {
  if (!args.congress) throw new Error('Congress number is required')
  const bType = validateBillType(args.type)
  if (!args.number) throw new Error('Bill number is required')
  return apiFetch<{ bill: BillDetail }>(`/bill/${args.congress}/${bType}/${args.number}`)
}, { method: 'get_bill' })

const getRecent = sg.wrap(async (args: { limit?: number }) => {
  const lim = clampLimit(args.limit)
  return apiFetch<BillSearchResponse>(`/bill?limit=${lim}&sort=updateDate+desc`)
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchBills, getBill, getRecent }
export type { Bill, BillDetail, BillSearchResponse }
console.log('settlegrid-congress-bills MCP server ready')
