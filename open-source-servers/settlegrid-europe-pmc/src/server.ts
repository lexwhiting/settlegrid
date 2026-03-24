/**
 * settlegrid-europe-pmc — Europe PMC MCP Server
 * Wraps European PubMed Central API with SettleGrid billing.
 *
 * Europe PMC provides access to millions of biomedical and life science
 * publications from PubMed, PMC, patents, and other sources.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EpmcArticle {
  id: string
  source: string
  pmid: string | null
  pmcid: string | null
  doi: string | null
  title: string
  authorString: string
  journalTitle: string | null
  pubYear: string | null
  abstractText: string | null
  citedByCount: number
  isOpenAccess: string
}

interface EpmcSearchResult {
  hitCount: number
  resultList: { result: EpmcArticle[] }
}

interface EpmcCitation {
  id: string
  source: string
  title: string
  authorString: string
  journalAbbreviation: string | null
  pubYear: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'europe-pmc' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchArticles(query: string, limit?: number): Promise<EpmcSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_articles', async () => {
    return apiFetch<EpmcSearchResult>(
      `/search?query=${q}&resultType=core&pageSize=${l}&format=json`
    )
  })
}

async function getArticle(id: string, source?: string): Promise<EpmcArticle> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const src = (source || 'MED').toUpperCase()
  if (!['MED', 'PMC', 'DOI'].includes(src)) {
    throw new Error(`Invalid source: ${source}. Must be MED, PMC, or DOI`)
  }
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_article', async () => {
    const result = await apiFetch<EpmcSearchResult>(
      `/search?query=${src === 'DOI' ? 'DOI:' : 'EXT_ID:'}${cleanId} SRC:${src}&resultType=core&format=json`
    )
    const articles = result.resultList?.result || []
    if (!articles.length) throw new Error(`No article found with ID ${id} in ${src}`)
    return articles[0]
  })
}

async function getCitations(id: string): Promise<{ total: number; citations: EpmcCitation[] }> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_citations', async () => {
    const data = await apiFetch<any>(
      `/MED/${cleanId}/citations?format=json&page=1&pageSize=25`
    )
    return {
      total: data.hitCount || 0,
      citations: (data.citationList?.citation || []) as EpmcCitation[],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchArticles, getArticle, getCitations }
export type { EpmcArticle, EpmcSearchResult, EpmcCitation }
console.log('settlegrid-europe-pmc server started')
