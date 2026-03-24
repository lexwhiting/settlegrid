/**
 * settlegrid-adsb-data — Aircraft ADS-B Data MCP Server
 * Wraps the OpenSky Network API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface StateVector {
  icao24: string
  callsign: string | null
  origin_country: string
  time_position: number | null
  last_contact: number
  longitude: number | null
  latitude: number | null
  baro_altitude: number | null
  on_ground: boolean
  velocity: number | null
  true_track: number | null
  vertical_rate: number | null
  geo_altitude: number | null
  squawk: string | null
  spi: boolean
  position_source: number
}

interface StatesResponse {
  time: number
  states: Array<(string | number | boolean | null)[]> | null
}

interface Flight {
  icao24: string
  firstSeen: number
  estDepartureAirport: string | null
  lastSeen: number
  estArrivalAirport: string | null
  callsign: string | null
}

interface Track {
  icao24: string
  startTime: number
  endTime: number
  callesign: string | null
  path: Array<[number, number | null, number | null, number | null, number | null, boolean]>
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://opensky-network.org/api'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenSky API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateIcao24(icao: string): string {
  const hex = icao.trim().toLowerCase()
  if (!/^[0-9a-f]{6}$/.test(hex)) throw new Error('ICAO24 must be a 6-character hex string')
  return hex
}

function parseState(s: (string | number | boolean | null)[]): StateVector {
  return {
    icao24: s[0] as string, callsign: s[1] as string | null,
    origin_country: s[2] as string, time_position: s[3] as number | null,
    last_contact: s[4] as number, longitude: s[5] as number | null,
    latitude: s[6] as number | null, baro_altitude: s[7] as number | null,
    on_ground: s[8] as boolean, velocity: s[9] as number | null,
    true_track: s[10] as number | null, vertical_rate: s[11] as number | null,
    geo_altitude: s[13] as number | null, squawk: s[14] as string | null,
    spi: s[15] as boolean, position_source: s[16] as number,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'adsb-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_states(lat?: number, lon?: number, radius?: number): Promise<{ time: number; aircraft: StateVector[] }> {
  return sg.wrap('get_states', async () => {
    const params = new URLSearchParams()
    if (lat !== undefined && lon !== undefined) {
      const r = radius ?? 1
      params.set('lamin', String(lat - r)); params.set('lamax', String(lat + r))
      params.set('lomin', String(lon - r)); params.set('lomax', String(lon + r))
    }
    const qs = params.toString()
    const data = await fetchJSON<StatesResponse>(`${API}/states/all${qs ? '?' + qs : ''}`)
    const aircraft = (data.states || []).slice(0, 50).map(parseState)
    return { time: data.time, aircraft }
  })
}

export async function get_flights(icao24: string, begin?: number, end?: number): Promise<Flight[]> {
  const icao = validateIcao24(icao24)
  return sg.wrap('get_flights', async () => {
    const now = Math.floor(Date.now() / 1000)
    const b = begin ?? now - 86400
    const e = end ?? now
    if (e - b > 2592000) throw new Error('Time range must be 30 days or less')
    return fetchJSON<Flight[]>(`${API}/flights/aircraft?icao24=${icao}&begin=${b}&end=${e}`)
  })
}

export async function get_track(icao24: string): Promise<Track> {
  const icao = validateIcao24(icao24)
  return sg.wrap('get_track', async () => {
    return fetchJSON<Track>(`${API}/tracks/all?icao24=${icao}&time=0`)
  })
}

console.log('settlegrid-adsb-data MCP server loaded')
