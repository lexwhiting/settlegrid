/**
 * settlegrid-bond-yields — Government Bond Yields MCP Server
 * Wraps US Treasury FiscalData API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface YieldData {
  record_date: string
  security_desc: string
  avg_interest_rate_amt: number
}

interface YieldCurve {
  date: string
  maturities: { tenor: string; yield: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Treasury API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'bond-yields' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getYields(date?: string): Promise<YieldData[]> {
  return sg.wrap('get_yields', async () => {
    const filter = date ? `&filter=record_date:eq:${date}` : ''
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=20${filter}`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
    }))
  })
}

async function getCurve(date?: string): Promise<YieldCurve> {
  return sg.wrap('get_curve', async () => {
    const filter = date ? `&filter=record_date:eq:${date}` : ''
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=30${filter}`
    )
    const records = data.data || []
    const curveDate = records[0]?.record_date || date || 'latest'
    const dateRecords = records.filter((r: any) => r.record_date === curveDate)
    const maturities = dateRecords.map((r: any) => ({
      tenor: r.security_desc || '',
      yield: parseFloat(r.avg_interest_rate_amt) || 0,
    }))
    return { date: curveDate, maturities }
  })
}

async function getHistorical(security: string, months?: number): Promise<YieldData[]> {
  if (!security) throw new Error('Security type is required (e.g., 10yr, 30yr)')
  return sg.wrap('get_historical', async () => {
    const m = months || 12
    const start = new Date()
    start.setMonth(start.getMonth() - m)
    const startStr = start.toISOString().slice(0, 10)
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:${startStr},security_desc:eq:${encodeURIComponent(security)}&sort=-record_date&page[size]=100`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getYields, getCurve, getHistorical }
console.log('settlegrid-bond-yields server started')
