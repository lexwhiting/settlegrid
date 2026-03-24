/**
 * settlegrid-credit-card — Credit Card Data MCP Server
 * Wraps CFPB Consumer Complaints API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Complaint {
  complaint_id: number
  date_received: string
  product: string
  sub_product: string
  issue: string
  company: string
  state: string
  consumer_disputed: string
  company_response: string
}

interface ComplaintStats {
  state: string
  totalComplaints: number
  topProducts: { product: string; count: number }[]
  topCompanies: { company: string; count: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CFPB API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'credit-card' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchCards(type?: string): Promise<Complaint[]> {
  return sg.wrap('search_cards', async () => {
    const product = type || 'credit card'
    const data = await fetchJSON<any>(`${API}/?product=${encodeURIComponent(product)}&size=10&sort=created_date_desc`)
    return (data.hits?.hits || []).map((h: any) => {
      const s = h._source || {}
      return {
        complaint_id: s.complaint_id || 0, date_received: s.date_received || '',
        product: s.product || '', sub_product: s.sub_product || '',
        issue: s.issue || '', company: s.company || '',
        state: s.state || '', consumer_disputed: s.consumer_disputed || '',
        company_response: s.company_response || '',
      }
    })
  })
}

async function getComplaints(product: string, limit?: number): Promise<Complaint[]> {
  if (!product) throw new Error('Product name is required')
  return sg.wrap('get_complaints', async () => {
    const l = Math.min(limit || 10, 50)
    const data = await fetchJSON<any>(`${API}/?product=${encodeURIComponent(product)}&size=${l}&sort=created_date_desc`)
    return (data.hits?.hits || []).map((h: any) => {
      const s = h._source || {}
      return {
        complaint_id: s.complaint_id || 0, date_received: s.date_received || '',
        product: s.product || '', sub_product: s.sub_product || '',
        issue: s.issue || '', company: s.company || '',
        state: s.state || '', consumer_disputed: s.consumer_disputed || '',
        company_response: s.company_response || '',
      }
    })
  })
}

async function getStats(state?: string): Promise<ComplaintStats> {
  return sg.wrap('get_stats', async () => {
    const filter = state ? `&state=${encodeURIComponent(state)}` : ''
    const data = await fetchJSON<any>(`${API}/?size=0${filter}&agg=product,company`)
    const prodBuckets = data.aggregations?.product?.buckets || []
    const compBuckets = data.aggregations?.company?.buckets || []
    return {
      state: state || 'ALL',
      totalComplaints: data.hits?.total?.value || 0,
      topProducts: prodBuckets.slice(0, 5).map((b: any) => ({ product: b.key, count: b.doc_count })),
      topCompanies: compBuckets.slice(0, 5).map((b: any) => ({ company: b.key, count: b.doc_count })),
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchCards, getComplaints, getStats }
console.log('settlegrid-credit-card server started')
