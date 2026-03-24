/**
 * settlegrid-smart-citizen — Smart Citizen Sensors MCP Server
 * Wraps the Smart Citizen API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ScDevice {
  id: number
  uuid: string
  name: string
  description: string
  state: string
  hardware: { name: string; version: string }
  data: {
    recorded_at: string
    added_at: string
    sensors: Array<{
      id: number
      ancestry: string
      name: string
      description: string
      unit: string
      value: number | null
      raw_value: number | null
      prev_value: number | null
    }>
  }
  owner: { id: number; username: string }
  location: { city: string; country: string; latitude: number; longitude: number }
  last_reading_at: string
  created_at: string
}

interface ScDeviceList {
  devices: ScDevice[]
  total: number
}

interface ScReading {
  timestamp: string
  value: number
  sensor_id: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.smartcitizen.me/v0'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Smart Citizen API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateId(id: number, label: string): number {
  if (!id || typeof id !== 'number' || id <= 0) throw new Error(`${label} must be a positive number`)
  return Math.floor(id)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'smart-citizen' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_device(id: number): Promise<ScDevice> {
  const deviceId = validateId(id, 'Device ID')
  return sg.wrap('get_device', async () => {
    return fetchJSON<ScDevice>(`${API}/devices/${deviceId}`)
  })
}

export async function list_devices(city?: string): Promise<ScDevice[]> {
  return sg.wrap('list_devices', async () => {
    const params = new URLSearchParams({ per_page: '25' })
    if (city) params.set('city', city.trim())
    return fetchJSON<ScDevice[]>(`${API}/devices?${params}`)
  })
}

export async function get_readings(device_id: number, sensor_id?: number): Promise<{ readings: ScReading[]; device_id: number }> {
  const devId = validateId(device_id, 'Device ID')
  return sg.wrap('get_readings', async () => {
    let url = `${API}/devices/${devId}/readings?rollup=1h&limit=24`
    if (sensor_id) {
      const sId = validateId(sensor_id, 'Sensor ID')
      url += `&sensor_id=${sId}`
    }
    const data = await fetchJSON<{ readings: ScReading[] }>(url)
    return { ...data, device_id: devId }
  })
}

console.log('settlegrid-smart-citizen MCP server loaded')
