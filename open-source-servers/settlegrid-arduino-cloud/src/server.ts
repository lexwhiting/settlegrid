/**
 * settlegrid-arduino-cloud — Arduino IoT Cloud MCP Server
 * Wraps the Arduino IoT Cloud API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ArduinoThing {
  id: string
  name: string
  device_id: string
  device_name: string
  sketch_id: string
  timezone: string
  webhook_active: boolean
  properties_count: number
  created_at: string
  updated_at: string
}

interface ArduinoProperty {
  id: string
  name: string
  type: string
  permission: string
  update_strategy: string
  last_value: unknown
  value_updated_at: string
  variable_name: string
  thing_id: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api2.arduino.cc/iot/v2'
const TOKEN_URL = 'https://api2.arduino.cc/iot/v1/clients/token'
const CLIENT_ID = process.env.ARDUINO_CLIENT_ID
const CLIENT_SECRET = process.env.ARDUINO_CLIENT_SECRET
if (!CLIENT_ID) throw new Error('ARDUINO_CLIENT_ID environment variable is required')
if (!CLIENT_SECRET) throw new Error('ARDUINO_CLIENT_SECRET environment variable is required')

let accessToken: string | null = null
let tokenExpiry = 0

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      audience: 'https://api2.arduino.cc/iot',
    }),
  })
  if (!res.ok) throw new Error(`Arduino auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return accessToken
}

async function fetchJSON<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Arduino API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateUUID(id: string, label: string): string {
  const trimmed = id.trim()
  if (!trimmed) throw new Error(`${label} is required`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'arduino-cloud' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function list_things(): Promise<ArduinoThing[]> {
  return sg.wrap('list_things', async () => {
    return fetchJSON<ArduinoThing[]>('/things')
  })
}

export async function get_thing(id: string): Promise<ArduinoThing> {
  const thingId = validateUUID(id, 'Thing ID')
  return sg.wrap('get_thing', async () => {
    return fetchJSON<ArduinoThing>(`/things/${thingId}`)
  })
}

export async function get_properties(thing_id: string): Promise<ArduinoProperty[]> {
  const thingId = validateUUID(thing_id, 'Thing ID')
  return sg.wrap('get_properties', async () => {
    return fetchJSON<ArduinoProperty[]>(`/things/${thingId}/properties`)
  })
}

console.log('settlegrid-arduino-cloud MCP server loaded')
