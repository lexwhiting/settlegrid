/**
 * settlegrid-openapc — OpenAPC Publication Costs MCP Server
 * Wraps OpenAPC OLAP API with SettleGrid billing.
 *
 * OpenAPC collects and disseminates data on article processing charges
 * (APCs) paid by universities and research institutions worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ApcCostResult {
  institution: string | null
  year: number | null
  totalEur: number
  articleCount: number
  avgCostEur: number
  drilldown: { key: string; amount: number; count: number }[]
}

interface ApcInstitution {
  name: string
  totalArticles: number
  totalSpendEur: number
}

interface ApcStats {
  year: number | null
  totalArticles: number
  totalSpendEur: number
  avgCostEur: number
  byPublisher: { publisher: string; count: number; totalEur: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://olap.openapc.net/cube/openapc'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'openapc' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCosts(institution?: string, year?: number): Promise<ApcCostResult> {
  return sg.wrap('get_costs', async () => {
    const cuts: string[] = []
    if (institution) cuts.push(`institution:${encodeURIComponent(institution)}`)
    if (year) cuts.push(`period:${year}`)
    const cutParam = cuts.length > 0 ? `&cut=${cuts.join('|')}` : ''
    const drillParam = institution ? 'drilldown=period' : 'drilldown=institution'
    const data = await apiFetch<any>(
      `/aggregate?${drillParam}&order=amount:desc${cutParam}`
    )
    const cells = data.cells || []
    let totalEur = 0
    let articleCount = 0
    const drilldown = cells.slice(0, 20).map((c: any) => {
      totalEur += c.amount || 0
      articleCount += c.num_items || 0
      return {
        key: c.institution || c.period?.toString() || 'unknown',
        amount: c.amount || 0,
        count: c.num_items || 0,
      }
    })
    return {
      institution: institution || null,
      year: year || null,
      totalEur,
      articleCount,
      avgCostEur: articleCount > 0 ? Math.round(totalEur / articleCount) : 0,
      drilldown,
    }
  })
}

async function listInstitutions(): Promise<{ institutions: ApcInstitution[] }> {
  return sg.wrap('list_institutions', async () => {
    const data = await apiFetch<any>(
      '/aggregate?drilldown=institution&order=amount:desc&pagesize=50'
    )
    const institutions: ApcInstitution[] = (data.cells || []).map((c: any) => ({
      name: c.institution || 'Unknown',
      totalArticles: c.num_items || 0,
      totalSpendEur: c.amount || 0,
    }))
    return { institutions }
  })
}

async function getStatsData(year?: number): Promise<ApcStats> {
  return sg.wrap('get_stats', async () => {
    const cutParam = year ? `&cut=period:${year}` : ''
    const data = await apiFetch<any>(
      `/aggregate?drilldown=publisher&order=amount:desc&pagesize=20${cutParam}`
    )
    const cells = data.cells || []
    let totalArticles = 0
    let totalSpendEur = 0
    const byPublisher = cells.map((c: any) => {
      totalArticles += c.num_items || 0
      totalSpendEur += c.amount || 0
      return {
        publisher: c.publisher || 'Unknown',
        count: c.num_items || 0,
        totalEur: c.amount || 0,
      }
    })
    return {
      year: year || null,
      totalArticles,
      totalSpendEur,
      avgCostEur: totalArticles > 0 ? Math.round(totalSpendEur / totalArticles) : 0,
      byPublisher,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCosts, listInstitutions, getStatsData as getStats }
export type { ApcCostResult, ApcInstitution, ApcStats }
console.log('settlegrid-openapc server started')
