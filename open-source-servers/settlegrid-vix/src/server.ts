/**
 * settlegrid-vix — VIX Volatility Index MCP Server
 * Wraps CBOE VIX data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface VIXData {
  date: string
  open: number
  high: number
  low: number
  close: number
}

interface TermStructure {
  date: string
  vix: number
  vix9d: number
  vix3m: number
  vix6m: number
  vix1y: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://cdn.cboe.com/api/global/us_indices/daily_prices'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CBOE API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'vix' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCurrent(): Promise<VIXData> {
  return sg.wrap('get_current', async () => {
    const data = await fetchJSON<any>(`${API}/VIX.json`)
    const records = data.data || []
    if (!records.length) throw new Error('No VIX data available')
    const latest = records[records.length - 1]
    return {
      date: latest.date || '', open: parseFloat(latest.open) || 0,
      high: parseFloat(latest.high) || 0, low: parseFloat(latest.low) || 0,
      close: parseFloat(latest.close) || 0,
    }
  })
}

async function getHistorical(days?: number): Promise<VIXData[]> {
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(`${API}/VIX.json`)
    const records = data.data || []
    const limit = Math.min(days || 30, 252)
    return records.slice(-limit).map((r: any) => ({
      date: r.date || '', open: parseFloat(r.open) || 0,
      high: parseFloat(r.high) || 0, low: parseFloat(r.low) || 0,
      close: parseFloat(r.close) || 0,
    }))
  })
}

async function getTermStructure(): Promise<TermStructure> {
  return sg.wrap('get_term_structure', async () => {
    const [vix, vix9d, vix3m, vix6m] = await Promise.all([
      fetchJSON<any>(`${API}/VIX.json`),
      fetchJSON<any>(`${API}/VIX9D.json`).catch(() => ({ data: [] })),
      fetchJSON<any>(`${API}/VIX3M.json`).catch(() => ({ data: [] })),
      fetchJSON<any>(`${API}/VIX6M.json`).catch(() => ({ data: [] })),
    ])
    const latest = (d: any) => { const r = d.data || []; return r.length ? parseFloat(r[r.length - 1].close) || 0 : 0 }
    return {
      date: new Date().toISOString().slice(0, 10),
      vix: latest(vix), vix9d: latest(vix9d),
      vix3m: latest(vix3m), vix6m: latest(vix6m), vix1y: 0,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCurrent, getHistorical, getTermStructure }
console.log('settlegrid-vix server started')
