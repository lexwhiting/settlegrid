/**
 * settlegrid-sensor-community — Sensor.Community Air Quality MCP Server
 * Wraps the Sensor.Community (formerly Luftdaten) API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SensorReading {
  id: number
  sensor: { id: number; pin: string; sensor_type: { id: number; name: string; manufacturer: string } }
  location: { id: number; latitude: string; longitude: string; altitude: string; country: string }
  sampling_rate: null | string
  timestamp: string
  sensordatavalues: Array<{ id: number; value: string; value_type: string }>
}

interface AreaResult {
  sensors: SensorReading[]
  count: number
  center: { lat: number; lon: number }
  radius_km: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://data.sensor.community/airrohr/v1'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sensor.Community API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(`${name} must be a valid number`)
  if (val < min || val > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return val
}

function validateSensorId(id: number): number {
  if (!id || typeof id !== 'number' || id <= 0) throw new Error('Sensor ID must be a positive number')
  return Math.floor(id)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'sensor-community' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_readings(sensor_id: number): Promise<SensorReading[]> {
  const id = validateSensorId(sensor_id)
  return sg.wrap('get_readings', async () => {
    return fetchJSON<SensorReading[]>(`${API}/sensor/${id}/`)
  })
}

export async function get_area(lat: number, lon: number, radius?: number): Promise<AreaResult> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const r = radius ?? 10
  if (r < 1 || r > 100) throw new Error('Radius must be between 1 and 100 km')
  return sg.wrap('get_area', async () => {
    const data = await fetchJSON<SensorReading[]>(
      `${API}/filter/area=${validLat},${validLon},${r}`
    )
    return { sensors: data, count: data.length, center: { lat: validLat, lon: validLon }, radius_km: r }
  })
}

export async function get_averages(sensor_id: number): Promise<SensorReading[]> {
  const id = validateSensorId(sensor_id)
  return sg.wrap('get_averages', async () => {
    return fetchJSON<SensorReading[]>(`${API}/sensor/${id}/`)
  })
}

console.log('settlegrid-sensor-community MCP server loaded')
