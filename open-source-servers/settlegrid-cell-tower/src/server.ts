/**
 * settlegrid-cell-tower — Cell Tower Locations MCP Server
 * Wraps public cell tower location databases with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CellTower {
  mcc: number
  mnc: number
  lac: number
  cellid: number
  lat: number
  lon: number
  range: number
  samples: number
  changeable: boolean
  radio: string
  created: number
  updated: number
  averageSignal: number
}

interface TowerSearchResult {
  towers: CellTower[]
  count: number
  center: { lat: number; lon: number }
  radius_km: number
}

interface CellStats {
  total_towers: number
  country?: string
  networks: Array<{ mcc: number; mnc: number; operator: string; count: number }>
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://opencellid.org'
const UNWIRED_API = 'https://us1.unwiredlabs.com/v2'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cell tower API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateMcc(mcc: number): number {
  if (!mcc || typeof mcc !== 'number' || mcc < 200 || mcc > 799) {
    throw new Error('MCC must be between 200 and 799')
  }
  return Math.floor(mcc)
}

function validatePositiveInt(val: number, label: string): number {
  if (typeof val !== 'number' || val < 0 || !Number.isFinite(val)) {
    throw new Error(`${label} must be a non-negative number`)
  }
  return Math.floor(val)
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(`${name} must be a valid number`)
  if (val < min || val > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return val
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'cell-tower' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_tower(mcc: number, mnc: number, lac: number, cellid: number): Promise<CellTower> {
  const validMcc = validateMcc(mcc)
  const validMnc = validatePositiveInt(mnc, 'MNC')
  const validLac = validatePositiveInt(lac, 'LAC')
  const validCell = validatePositiveInt(cellid, 'Cell ID')
  return sg.wrap('get_tower', async () => {
    const params = new URLSearchParams({
      mcc: String(validMcc), mnc: String(validMnc),
      lac: String(validLac), cellid: String(validCell), format: 'json',
    })
    return fetchJSON<CellTower>(`${API}/cell/get?${params}`)
  })
}

export async function search_area(lat: number, lon: number, radius?: number): Promise<TowerSearchResult> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const r = radius ?? 5
  if (r < 0.1 || r > 50) throw new Error('Radius must be between 0.1 and 50 km')
  return sg.wrap('search_area', async () => {
    const params = new URLSearchParams({
      lat: String(validLat), lon: String(validLon),
      radius: String(r * 1000), format: 'json', limit: '50',
    })
    const data = await fetchJSON<{ cells: CellTower[] }>(`${API}/cell/getInArea?${params}`)
    return {
      towers: data.cells || [],
      count: (data.cells || []).length,
      center: { lat: validLat, lon: validLon },
      radius_km: r,
    }
  })
}

export async function get_stats(country?: string): Promise<CellStats> {
  return sg.wrap('get_stats', async () => {
    const params = new URLSearchParams({ format: 'json' })
    if (country) params.set('country', country.trim().toUpperCase())
    const data = await fetchJSON<CellStats>(`${API}/cell/stats?${params}`)
    return { ...data, country: country?.toUpperCase() }
  })
}

console.log('settlegrid-cell-tower MCP server loaded')
