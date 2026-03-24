/**
 * settlegrid-banking-rates — Banking & Treasury Rates MCP Server
 * Wraps US Treasury FiscalData API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TreasuryRate {
  record_date: string
  security_desc: string
  avg_interest_rate_amt: number
  security_type_desc: string
}

interface FedRate {
  date: string
  rate: number
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Treasury API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'banking-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getTreasuryRates(date?: string): Promise<TreasuryRate[]> {
  return sg.wrap('get_treasury_rates', async () => {
    const filter = date ? `&filter=record_date:eq:${date}` : ''
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=20${filter}`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
      security_type_desc: d.security_type_desc || '',
    }))
  })
}

async function getFedRate(): Promise<FedRate> {
  return sg.wrap('get_fed_rate', async () => {
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1&filter=security_desc:eq:Treasury Bills`
    )
    const record = data.data?.[0]
    return {
      date: record?.record_date || new Date().toISOString().slice(0, 10),
      rate: parseFloat(record?.avg_interest_rate_amt) || 0,
      description: 'Federal Funds effective rate (proxy from Treasury bills)',
    }
  })
}

async function getHistorical(type: string, months?: number): Promise<TreasuryRate[]> {
  if (!type) throw new Error('Rate type is required (treasury, fed_funds, prime)')
  return sg.wrap('get_historical', async () => {
    const m = months || 12
    const start = new Date()
    start.setMonth(start.getMonth() - m)
    const startStr = start.toISOString().slice(0, 10)
    const secFilter = type === 'treasury' ? 'Treasury Bills' : type === 'fed_funds' ? 'Treasury Bills' : 'Treasury Notes'
    const data = await fetchJSON<any>(
      `${API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:${startStr},security_desc:eq:${encodeURIComponent(secFilter)}&sort=-record_date&page[size]=100`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
      security_type_desc: d.security_type_desc || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getTreasuryRates, getFedRate, getHistorical }
console.log('settlegrid-banking-rates server started')
