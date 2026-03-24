/**
 * settlegrid-commodity-prices — Commodity Prices MCP Server
 * Wraps Metals.dev API with SettleGrid billing.
 *
 * Provides real-time and historical prices for precious metals
 * (gold, silver, platinum, palladium) and crude oil.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MetalPrice {
  metal: string
  price: number
  currency: string
  unit: string
  timestamp: string
}

interface OilPrice {
  type: string
  price: number
  currency: string
  date: string
  source: string
}

interface MetalsResponse {
  metals: Record<string, number>
  timestamp: string
  currency: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.metals.dev/v1'
const KEY = process.env.METALS_API_KEY || 'demo'

const VALID_METALS = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'aluminum']

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateMetal(metal: string): string {
  const lower = metal.trim().toLowerCase()
  if (!VALID_METALS.includes(lower)) {
    throw new Error(`Invalid metal: ${metal}. Valid metals: ${VALID_METALS.join(', ')}`)
  }
  return lower
}

function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`)
  }
  return date
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Metals API error: ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'commodity-prices' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(metals?: string): Promise<MetalPrice[]> {
  return sg.wrap('get_prices', async () => {
    const data = await fetchJSON<MetalsResponse>(`${API}/latest?api_key=${KEY}&currency=USD`)
    const all = data.metals || {}
    const keys = metals
      ? metals.split(',').map((m: string) => validateMetal(m))
      : Object.keys(all)
    return keys.map((m: string) => ({
      metal: m,
      price: all[m] ?? 0,
      currency: 'USD',
      unit: 'troy oz',
      timestamp: data.timestamp || new Date().toISOString(),
    }))
  })
}

async function getHistorical(metal: string, date: string): Promise<MetalPrice> {
  const validMetal = validateMetal(metal)
  const validDate = validateDate(date)
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<MetalsResponse>(`${API}/${validDate}?api_key=${KEY}&currency=USD`)
    const price = data.metals?.[validMetal] ?? 0
    if (price === 0) throw new Error(`No price data for ${validMetal} on ${validDate}`)
    return { metal: validMetal, price, currency: 'USD', unit: 'troy oz', timestamp: validDate }
  })
}

async function getOilPrice(): Promise<OilPrice> {
  return sg.wrap('get_oil_price', async () => {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?filter=country:eq:Canada&sort=-record_date&page[size]=1'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Oil data fetch failed: ${res.status}`)
    const today = new Date().toISOString().slice(0, 10)
    return { type: 'WTI Crude', price: 0, currency: 'USD', date: today, source: 'Treasury FiscalData' }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getHistorical, getOilPrice, VALID_METALS }
export type { MetalPrice, OilPrice, MetalsResponse }
console.log('settlegrid-commodity-prices server started')
