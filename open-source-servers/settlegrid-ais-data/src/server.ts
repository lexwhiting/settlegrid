/**
 * settlegrid-ais-data — Ship AIS Data MCP Server
 * Wraps the Finnish Digitraffic Marine API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface VesselLocation {
  mmsi: number
  type: string
  geometry: { type: string; coordinates: [number, number] }
  properties: {
    sog: number
    cog: number
    navStat: number
    rot: number
    posAcc: boolean
    raim: boolean
    heading: number
    timestamp: number
    timestampExternal: number
  }
}

interface VesselMetadata {
  mmsi: number
  name: string
  shipType: number
  draught: number
  eta: number
  posType: number
  referencePointA: number
  referencePointB: number
  referencePointC: number
  referencePointD: number
  callSign: string
  imo: number
  destination: string
  timestamp: number
}

interface PortInfo {
  locode: string
  name: string
  nationality: string
  latitude: number
  longitude: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://meri.digitraffic.fi/api/v1'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'Digitraffic-User': 'settlegrid-mcp' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Digitraffic API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(`${name} must be a valid number`)
  if (val < min || val > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return val
}

function validateMmsi(mmsi: number): number {
  if (!mmsi || typeof mmsi !== 'number') throw new Error('MMSI is required and must be a number')
  if (mmsi < 100000000 || mmsi > 999999999) throw new Error('MMSI must be a 9-digit number')
  return mmsi
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ais-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_vessels(lat: number, lon: number, radius?: number): Promise<{ vessels: VesselLocation[]; count: number }> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const r = radius ?? 20
  if (r < 1 || r > 200) throw new Error('Radius must be between 1 and 200 km')
  return sg.wrap('get_vessels', async () => {
    const data = await fetchJSON<{ type: string; features: VesselLocation[] }>(
      `${API}/locations/latest?from=${validLat - r / 111}&to=${validLon - r / 111}`
    )
    const vessels = (data.features || []).slice(0, 50)
    return { vessels, count: vessels.length }
  })
}

export async function get_vessel(mmsi: number): Promise<VesselMetadata> {
  const id = validateMmsi(mmsi)
  return sg.wrap('get_vessel', async () => {
    return fetchJSON<VesselMetadata>(`${API}/metadata/vessels/${id}`)
  })
}

export async function get_port(locode: string): Promise<PortInfo> {
  const code = locode.trim().toUpperCase()
  if (!code || code.length < 4 || code.length > 6) throw new Error('LOCODE must be 4-6 characters (e.g., FIHEL)')
  return sg.wrap('get_port', async () => {
    return fetchJSON<PortInfo>(`${API}/metadata/ports/${code}`)
  })
}

console.log('settlegrid-ais-data MCP server loaded')
