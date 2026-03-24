/**
 * settlegrid-iss-tracker — ISS Tracker MCP Server
 * Wraps the Open Notify API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface IssPosition {
  message: string
  timestamp: number
  iss_position: {
    latitude: string
    longitude: string
  }
}

interface IssCrew {
  message: string
  number: number
  people: Array<{
    name: string
    craft: string
  }>
}

interface IssPass {
  latitude: number
  longitude: number
  altitude: number
  passes: number
  results: Array<{
    duration: number
    risetime: number
  }>
}

interface FormattedPosition {
  latitude: number
  longitude: number
  timestamp: string
  unix_timestamp: number
}

interface FormattedCrew {
  total: number
  people: Array<{ name: string; craft: string }>
}

interface FormattedPasses {
  observer: { lat: number; lon: number }
  count: number
  passes: Array<{ rise_time: string; duration_seconds: number; duration_minutes: number }>
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'http://api.open-notify.org'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Notify API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(`${name} must be a valid number`)
  if (val < min || val > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return val
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'iss-tracker' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_position(): Promise<FormattedPosition> {
  return sg.wrap('get_position', async () => {
    const data = await fetchJSON<IssPosition>(`${API}/iss-now.json`)
    return {
      latitude: parseFloat(data.iss_position.latitude),
      longitude: parseFloat(data.iss_position.longitude),
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      unix_timestamp: data.timestamp,
    }
  })
}

export async function get_crew(): Promise<FormattedCrew> {
  return sg.wrap('get_crew', async () => {
    const data = await fetchJSON<IssCrew>(`${API}/astros.json`)
    return { total: data.number, people: data.people }
  })
}

export async function get_passes(lat: number, lon: number, count?: number): Promise<FormattedPasses> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const n = count ?? 5
  if (n < 1 || n > 100) throw new Error('Count must be between 1 and 100')
  return sg.wrap('get_passes', async () => {
    const data = await fetchJSON<IssPass>(
      `${API}/iss-pass.json?lat=${validLat}&lon=${validLon}&n=${n}`
    )
    return {
      observer: { lat: validLat, lon: validLon },
      count: data.passes,
      passes: (data.results || []).map(p => ({
        rise_time: new Date(p.risetime * 1000).toISOString(),
        duration_seconds: p.duration,
        duration_minutes: Math.round(p.duration / 60 * 10) / 10,
      })),
    }
  })
}

console.log('settlegrid-iss-tracker MCP server loaded')
