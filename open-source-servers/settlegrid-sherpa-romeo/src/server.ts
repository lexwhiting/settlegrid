/**
 * settlegrid-sherpa-romeo — SHERPA/RoMEO Journal Policies MCP Server
 * Wraps SHERPA/RoMEO API with SettleGrid billing.
 *
 * SHERPA/RoMEO provides information about publisher copyright and
 * self-archiving policies for academic journals worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface JournalPolicy {
  id: number
  title: string
  issns: string[]
  publisher: { name: string; country: string | null }
  oaProhibited: boolean
  policies: PolicyDetail[]
  url: string | null
}

interface PolicyDetail {
  permittedOa: {
    location: string
    version: string
    conditions: string[]
    embargo: string | null
    license: string | null
  }[]
  openAccessProhibited: boolean
}

interface JournalSearchResult {
  total: number
  items: { id: number; title: string; issns: string[]; publisher: string }[]
}

interface PublisherEntry {
  id: number
  name: string
  country: string | null
  url: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://v2.sherpa.ac.uk/cgi/retrieve'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateISSN(issn: string): string {
  const clean = issn.trim()
  if (!/^\d{4}-?\d{3}[\dXx]$/.test(clean)) {
    throw new Error(`Invalid ISSN format: ${issn}. Expected: 0028-0836`)
  }
  return clean
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'sherpa-romeo' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPolicy(issn: string): Promise<JournalPolicy> {
  const validIssn = validateISSN(issn)
  return sg.wrap('get_policy', async () => {
    const data = await apiFetch<any>(
      `?item-type=publication&filter=[["issn","equals","${validIssn}"]]&format=Json`
    )
    const items = data.items || []
    if (!items.length) throw new Error(`No journal found with ISSN: ${validIssn}`)
    const item = items[0]
    return {
      id: item.id || 0,
      title: item.title?.[0]?.title || 'Unknown',
      issns: item.issns?.map((i: any) => i.issn) || [],
      publisher: {
        name: item.publishers?.[0]?.publisher?.name?.[0]?.name || 'Unknown',
        country: item.publishers?.[0]?.publisher?.country || null,
      },
      oaProhibited: item.listed_in_doaj === 'no',
      policies: (item.publisher_policy || []).map((p: any) => ({
        permittedOa: (p.permitted_oa || []).map((oa: any) => ({
          location: oa.location?.location?.[0] || 'unknown',
          version: oa.article_version?.[0] || 'unknown',
          conditions: oa.conditions || [],
          embargo: oa.embargo?.amount ? `${oa.embargo.amount} ${oa.embargo.units}` : null,
          license: oa.license?.[0]?.license || null,
        })),
        openAccessProhibited: p.open_access_prohibited === 'yes',
      })),
      url: item.url || null,
    }
  })
}

async function searchJournals(query: string): Promise<JournalSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_journals', async () => {
    const q = encodeURIComponent(query.trim())
    const data = await apiFetch<any>(
      `?item-type=publication&filter=[["title","contains word","${q}"]]&format=Json`
    )
    const items = (data.items || []).slice(0, 20)
    return {
      total: items.length,
      items: items.map((i: any) => ({
        id: i.id || 0,
        title: i.title?.[0]?.title || 'Unknown',
        issns: i.issns?.map((x: any) => x.issn) || [],
        publisher: i.publishers?.[0]?.publisher?.name?.[0]?.name || 'Unknown',
      })),
    }
  })
}

async function listPublishers(limit?: number): Promise<{ publishers: PublisherEntry[] }> {
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('list_publishers', async () => {
    const data = await apiFetch<any>(
      `?item-type=publisher&format=Json&limit=${l}`
    )
    const publishers: PublisherEntry[] = (data.items || []).map((i: any) => ({
      id: i.id || 0,
      name: i.name?.[0]?.name || 'Unknown',
      country: i.country || null,
      url: i.url || null,
    }))
    return { publishers }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPolicy, searchJournals, listPublishers }
export type { JournalPolicy, PolicyDetail, JournalSearchResult, PublisherEntry }
console.log('settlegrid-sherpa-romeo server started')
