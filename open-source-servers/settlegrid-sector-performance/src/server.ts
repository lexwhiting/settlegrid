/**
 * settlegrid-sector-performance — Sector Performance MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Analyze S&P 500 sector performance, drill into individual sectors
 * for top stocks and market cap, and view historical sector returns.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SectorPerf {
  sector: string
  changesPercentage: string
}

interface SectorDetail {
  sector: string
  performance: number
  topStocks: { symbol: string; name: string; marketCap: number }[]
  totalMarketCap: number
  stockCount: number
}

interface HistoricalSectorPerf {
  date: string
  sector: string
  changesPercentage: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const VALID_PERIODS = ['1D', '5D', '1M', '3M', 'YTD', '1Y']
const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Basic Materials', 'Real Estate', 'Utilities',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSector(name: string): string {
  const match = VALID_SECTORS.find(s => s.toLowerCase() === name.toLowerCase())
  if (!match) throw new Error(`Invalid sector. Valid: ${VALID_SECTORS.join(', ')}`)
  return match
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API}${path}${sep}apikey=${KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FMP API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'sector-performance' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPerformance(period?: string): Promise<SectorPerf[]> {
  return sg.wrap('get_performance', async () => {
    const p = (period || '1D').toUpperCase()
    if (!VALID_PERIODS.includes(p)) {
      throw new Error(`Invalid period. Valid: ${VALID_PERIODS.join(', ')}`)
    }
    return fetchJSON<SectorPerf[]>('/sector-performance')
  })
}

async function getSector(name: string): Promise<SectorDetail> {
  if (!name) throw new Error('Sector name is required')
  const sectorName = validateSector(name)
  return sg.wrap('get_sector', async () => {
    const [perf, stocks] = await Promise.all([
      fetchJSON<SectorPerf[]>('/sector-performance'),
      fetchJSON<any[]>(`/stock-screener?sector=${encodeURIComponent(sectorName)}&limit=5`),
    ])
    const match = perf.find((s: SectorPerf) =>
      s.sector.toLowerCase().includes(sectorName.toLowerCase())
    )
    return {
      sector: match?.sector || sectorName,
      performance: parseFloat(match?.changesPercentage || '0'),
      topStocks: stocks.map((s: any) => ({
        symbol: s.symbol, name: s.companyName || '', marketCap: s.marketCap || 0,
      })),
      totalMarketCap: stocks.reduce((sum: number, s: any) => sum + (s.marketCap || 0), 0),
      stockCount: stocks.length,
    }
  })
}

async function getHistorical(sector: string, months?: number): Promise<HistoricalSectorPerf[]> {
  if (!sector) throw new Error('Sector name is required')
  const m = Math.min(Math.max(months || 6, 1), 24)
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(`/historical-sectors-performance?limit=${m * 22}`)
    return (Array.isArray(data) ? data : [])
      .filter((d: any) => d.date)
      .map((d: any) => ({
        date: d.date,
        sector,
        changesPercentage: parseFloat(d[sector + 'ChangesPercentage'] || '0'),
      }))
      .filter((d: HistoricalSectorPerf) => d.changesPercentage !== 0)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPerformance, getSector, getHistorical, VALID_SECTORS }
export type { SectorPerf, SectorDetail, HistoricalSectorPerf }
console.log('settlegrid-sector-performance server started')
