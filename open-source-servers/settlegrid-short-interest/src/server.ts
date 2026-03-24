/**
 * settlegrid-short-interest — Short Interest Data MCP Server
 * Wraps FINRA API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ShortInterest {
  symbol: string
  settlementDate: string
  shortInterest: number
  avgDailyVolume: number
  daysToCover: number
}

interface ShortVolume {
  symbol: string
  date: string
  shortVolume: number
  totalVolume: number
  shortPercent: number
}

interface ThresholdSecurity {
  symbol: string
  securityName: string
  marketCategory: string
  thresholdListFlag: string
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.finra.org/data/group/otcMarket'
const HEADERS = { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`FINRA API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'short-interest' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getShortInterest(symbol: string): Promise<ShortInterest> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_short_interest', async () => {
    const data = await fetchJSON<any[]>(`${API}/name/shortInterest?symbol=${encodeURIComponent(symbol.toUpperCase())}&limit=1`)
    if (!data.length) throw new Error(`No short interest data for ${symbol}`)
    const d = data[0]
    return {
      symbol: symbol.toUpperCase(),
      settlementDate: d.settlementDate || '',
      shortInterest: d.shortInterest || 0,
      avgDailyVolume: d.avgDailyShareVolume || 0,
      daysToCover: d.daysToCover || 0,
    }
  })
}

async function getVolume(symbol: string, days?: number): Promise<ShortVolume[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_volume', async () => {
    const limit = Math.min(days || 5, 30)
    const data = await fetchJSON<any[]>(`${API}/name/regShoDaily?symbol=${encodeURIComponent(symbol.toUpperCase())}&limit=${limit}`)
    return data.map((d: any) => ({
      symbol: symbol.toUpperCase(),
      date: d.tradeReportDate || '',
      shortVolume: d.shortVolume || 0,
      totalVolume: d.totalVolume || 0,
      shortPercent: d.totalVolume ? (d.shortVolume / d.totalVolume) * 100 : 0,
    }))
  })
}

async function getThresholdList(): Promise<ThresholdSecurity[]> {
  return sg.wrap('get_threshold_list', async () => {
    const data = await fetchJSON<any[]>(`${API}/name/thresholdList?limit=50`)
    return data.map((d: any) => ({
      symbol: d.symbol || '',
      securityName: d.securityName || '',
      marketCategory: d.marketCategory || '',
      thresholdListFlag: d.thresholdListFlag || '',
      date: d.tradeDate || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getShortInterest, getVolume, getThresholdList }
console.log('settlegrid-short-interest server started')
