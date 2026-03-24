/**
 * settlegrid-cfr — Code of Federal Regulations MCP Server
 * Wraps the eCFR API with SettleGrid billing.
 *
 * Browse, search, and retrieve sections from the Code of
 * Federal Regulations maintained by the GPO.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CFRTitle {
  number: number
  name: string
  latest_issue_date: string
  up_to_date_as_of: string
}

interface CFRSection {
  title: number
  part: string
  section: string
  heading: string
  content: string
  authority: string
  source: string
}

interface CFRSearchResult {
  results: {
    title: number
    part: string
    section: string
    heading: string
    snippet: string
    structure_index: string
  }[]
  total_count: number
}

interface TitlesResponse {
  titles: CFRTitle[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.ecfr.gov/api/versioner/v1'
const SEARCH_BASE = 'https://www.ecfr.gov/api/search/v1'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`eCFR API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateTitle(title: number): number {
  if (title < 1 || title > 50 || !Number.isInteger(title)) {
    throw new Error(`Invalid CFR title: ${title}. Must be 1-50.`)
  }
  return title
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'cfr',
  pricing: { defaultCostCents: 1, methods: { search_sections: 1, get_section: 1, list_titles: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSections = sg.wrap(async (args: { query: string; title?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const params = new URLSearchParams({ query: q, per_page: '20' })
  if (args.title !== undefined) {
    validateTitle(args.title)
    params.set('title', String(args.title))
  }
  return apiFetch<CFRSearchResult>(`${SEARCH_BASE}/results?${params}`)
}, { method: 'search_sections' })

const getSection = sg.wrap(async (args: { title: number; part: string; section: string }) => {
  validateTitle(args.title)
  if (!args.part?.trim()) throw new Error('Part is required')
  if (!args.section?.trim()) throw new Error('Section is required')
  const today = new Date().toISOString().slice(0, 10)
  const url = `${API_BASE}/full/${today}/title-${args.title}.json?part=${encodeURIComponent(args.part)}&section=${encodeURIComponent(args.section)}`
  return apiFetch<CFRSection>(url)
}, { method: 'get_section' })

const listTitles = sg.wrap(async () => {
  return apiFetch<TitlesResponse>(`${API_BASE}/titles`)
}, { method: 'list_titles' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSections, getSection, listTitles }
export type { CFRTitle, CFRSection, CFRSearchResult }
console.log('settlegrid-cfr MCP server ready')
