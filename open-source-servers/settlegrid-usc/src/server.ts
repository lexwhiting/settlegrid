/**
 * settlegrid-usc — US Code MCP Server
 * Wraps the US Code data with SettleGrid billing.
 *
 * Provides search and retrieval for the United States Code,
 * the codification of general and permanent federal statutes.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface USCTitle {
  number: number
  name: string
  positive_law: boolean
}

interface USCSection {
  title: number
  section: string
  heading: string
  content: string
  status: string
}

interface USCSearchResult {
  query: string
  total: number
  results: {
    title: number
    section: string
    heading: string
    snippet: string
    url: string
  }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const USC_BASE = 'https://uscode.house.gov'
const TITLES_URL = 'https://uscode.house.gov/browse/prelim@title/&edition=prelim'

const USC_TITLES: USCTitle[] = [
  { number: 1, name: 'General Provisions', positive_law: true },
  { number: 2, name: 'The Congress', positive_law: false },
  { number: 3, name: 'The President', positive_law: true },
  { number: 4, name: 'Flag and Seal', positive_law: true },
  { number: 5, name: 'Government Organization and Employees', positive_law: true },
  { number: 7, name: 'Agriculture', positive_law: false },
  { number: 10, name: 'Armed Forces', positive_law: true },
  { number: 11, name: 'Bankruptcy', positive_law: true },
  { number: 12, name: 'Banks and Banking', positive_law: false },
  { number: 15, name: 'Commerce and Trade', positive_law: false },
  { number: 17, name: 'Copyrights', positive_law: true },
  { number: 18, name: 'Crimes and Criminal Procedure', positive_law: true },
  { number: 21, name: 'Food and Drugs', positive_law: false },
  { number: 26, name: 'Internal Revenue Code', positive_law: true },
  { number: 28, name: 'Judiciary and Judicial Procedure', positive_law: true },
  { number: 29, name: 'Labor', positive_law: false },
  { number: 31, name: 'Money and Finance', positive_law: true },
  { number: 35, name: 'Patents', positive_law: true },
  { number: 42, name: 'The Public Health and Welfare', positive_law: false },
  { number: 52, name: 'Voting and Elections', positive_law: true },
]

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'usc',
  pricing: { defaultCostCents: 1, methods: { search_sections: 1, get_section: 1, list_titles: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSections = sg.wrap(async (args: { query: string; title?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const params = new URLSearchParams({ q, pageSize: '20' })
  if (args.title !== undefined) params.set('title', String(args.title))
  const url = `${USC_BASE}/search?type=usc&${params}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USC search ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return { query: q, total: data.totalCount ?? 0, results: data.results ?? [] } as USCSearchResult
}, { method: 'search_sections' })

const getSection = sg.wrap(async (args: { title: number; section: string }) => {
  if (!args.title || args.title < 1 || args.title > 54) throw new Error('Invalid title number (1-54)')
  if (!args.section?.trim()) throw new Error('Section number is required')
  const url = `${USC_BASE}/view.xhtml?req=granuleid:USC-prelim-title${args.title}-section${args.section}&edition=prelim`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`USC section fetch ${res.status}`)
  const text = await res.text()
  return { title: args.title, section: args.section, heading: '', content: text.slice(0, 5000), status: 'prelim' } as USCSection
}, { method: 'get_section' })

const listTitles = sg.wrap(async () => {
  return { titles: USC_TITLES, count: USC_TITLES.length }
}, { method: 'list_titles' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSections, getSection, listTitles, USC_TITLES }
export type { USCTitle, USCSection, USCSearchResult }
console.log('settlegrid-usc MCP server ready')
