/**
 * settlegrid-purpleair — PurpleAir Sensors MCP Server
 * Wraps the PurpleAir API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PaSensor {
  sensor_index: number
  name: string
  model: string
  latitude: number
  longitude: number
  altitude: number
  pm2_5: number
  pm10_0: number
  temperature: number
  humidity: number
  pressure: number
  last_seen: number
  date_created: number
}

interface PaSensorResponse {
  api_version: string
  time_stamp: number
  sensor: PaSensor
}

interface PaSensorsResponse {
  api_version: string
  time_stamp: number
  fields: string[]
  data: Array<Array<number | string | null>>
}

interface PaHistoryResponse {
  api_version: string
  time_stamp: number
  sensor_index: number
  data: Array<{ time_stamp: number; pm2_5: number; humidity: number; temperature: number }>
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.purpleair.com/v1'
const API_KEY = process.env.PURPLEAIR_API_KEY
if (!API_KEY) throw new Error('PURPLEAIR_API_KEY environment variable is required')

const FIELDS = 'name,model,latitude,longitude,altitude,pm2.5,pm10.0,temperature,humidity,pressure,last_seen'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(path: string, params?: URLSearchParams): Promise<T> {
  const qs = params ? `?${params}` : ''
  const res = await fetch(`${API}${path}${qs}`, {
    headers: { 'X-API-Key': API_KEY! },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PurpleAir API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateSensorIndex(idx: number): number {
  if (!idx || typeof idx !== 'number' || idx <= 0) throw new Error('Sensor index must be a positive number')
  return Math.floor(idx)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'purpleair' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_sensor(sensor_index: number): Promise<PaSensorResponse> {
  const idx = validateSensorIndex(sensor_index)
  return sg.wrap('get_sensor', async () => {
    const params = new URLSearchParams({ fields: FIELDS })
    return fetchJSON<PaSensorResponse>(`/sensors/${idx}`, params)
  })
}

export async function get_sensors(lat: number, lon: number, radius?: number): Promise<PaSensorsResponse> {
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90')
  if (typeof lon !== 'number' || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180')
  const r = radius ?? 5
  if (r < 0.1 || r > 50) throw new Error('Radius must be between 0.1 and 50 km')
  const nwLat = lat + (r / 111); const nwLng = lon - (r / 111)
  const seLat = lat - (r / 111); const seLng = lon + (r / 111)
  return sg.wrap('get_sensors', async () => {
    const params = new URLSearchParams({
      fields: FIELDS,
      nwlat: String(nwLat), nwlng: String(nwLng),
      selat: String(seLat), selng: String(seLng),
    })
    return fetchJSON<PaSensorsResponse>('/sensors', params)
  })
}

export async function get_history(sensor_index: number, days?: number): Promise<PaHistoryResponse> {
  const idx = validateSensorIndex(sensor_index)
  const d = days ?? 1
  if (d < 1 || d > 14) throw new Error('Days must be between 1 and 14')
  const end = Math.floor(Date.now() / 1000)
  const start = end - (d * 86400)
  return sg.wrap('get_history', async () => {
    const params = new URLSearchParams({
      fields: 'pm2.5,humidity,temperature',
      start_timestamp: String(start),
      end_timestamp: String(end),
      average: '60',
    })
    return fetchJSON<PaHistoryResponse>(`/sensors/${idx}/history`, params)
  })
}

console.log('settlegrid-purpleair MCP server loaded')
