/**
 * settlegrid-case-law — Historical Case Law MCP Server
 * Wraps the Harvard Caselaw Access Project API with SettleGrid billing.
 *
 * Provides access to millions of historical US court cases
 * digitized by the Harvard Law School Library.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CaseResult {
  id: number
  url: string
  name: string
  name_abbreviation: string
  decision_date: string
  docket_number: string
  court: { id: number; slug: string; name: string }
  jurisdiction: { id: number; slug: string; name: string }
  citations: { cite: string; type: string }[]
  volume: { volume_number: string }
}

interface CaseDetail extends CaseResult {
  casebody?: {
    data: {
      head_matter: string
      opinions: { type: string; author: string; text: string }[]
    }
  }
}

interface Court {
  id: number
  slug: string
  name: string
  jurisdiction: string
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.case.law/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Caselaw API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Query must not be empty')
  return trimmed
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'case-law',
  pricing: { defaultCostCents: 2, methods: { search_cases: 2, get_case: 2, list_courts: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchCases = sg.wrap(async (args: { query: string; jurisdiction?: string; limit?: number }) => {
  const q = validateQuery(args.query)
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ search: q, page_size: String(lim) })
  if (args.jurisdiction) params.set('jurisdiction', args.jurisdiction.trim())
  return apiFetch<PaginatedResponse<CaseResult>>(`/cases/?${params}`)
}, { method: 'search_cases' })

const getCase = sg.wrap(async (args: { id: string }) => {
  if (!args.id) throw new Error('Case ID is required')
  return apiFetch<CaseDetail>(`/cases/${encodeURIComponent(args.id)}/`)
}, { method: 'get_case' })

const listCourts = sg.wrap(async () => {
  return apiFetch<PaginatedResponse<Court>>('/courts/?page_size=100')
}, { method: 'list_courts' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchCases, getCase, listCourts }
export type { CaseResult, CaseDetail, Court, PaginatedResponse }
console.log('settlegrid-case-law MCP server ready')
