/**
 * Batch 3E2 — 15 IoT/Hardware MCP servers (#161–#175)
 */
import { gen } from './core.mjs'

console.log('\n📡 Batch 3E2 — IoT/Hardware (15 servers)\n')

// ─── 161. thingspeak ──────────────────────────────────────────────────────
gen({
  slug: 'thingspeak',
  title: 'ThingSpeak IoT Data',
  desc: 'Read IoT channel data and field feeds from ThingSpeak. Free API key for public and private channels.',
  api: { base: 'https://api.thingspeak.com', name: 'ThingSpeak', docs: 'https://www.mathworks.com/help/thingspeak/' },
  key: { env: 'THINGSPEAK_API_KEY', url: 'https://thingspeak.com', required: false },
  keywords: ['iot', 'thingspeak', 'sensors', 'channels', 'data-logging'],
  methods: [
    { name: 'get_channel', display: 'Get channel feed data', cost: 1, params: 'id, results?', inputs: [
      { name: 'id', type: 'number', required: true, desc: 'ThingSpeak channel ID' },
      { name: 'results', type: 'number', required: false, desc: 'Number of results to return (default: 10, max: 8000)' },
    ]},
    { name: 'get_field', display: 'Get specific field data from a channel', cost: 1, params: 'channel_id, field, results?', inputs: [
      { name: 'channel_id', type: 'number', required: true, desc: 'ThingSpeak channel ID' },
      { name: 'field', type: 'number', required: true, desc: 'Field number (1-8)' },
      { name: 'results', type: 'number', required: false, desc: 'Number of results to return (default: 10)' },
    ]},
    { name: 'list_public', display: 'List public channels by tag', cost: 1, params: 'tag?', inputs: [
      { name: 'tag', type: 'string', required: false, desc: 'Tag to filter public channels' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-thingspeak — ThingSpeak IoT Data MCP Server
 * Wraps the ThingSpeak API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChannelFeed {
  channel: {
    id: number
    name: string
    description: string
    field1?: string
    field2?: string
    field3?: string
    field4?: string
    created_at: string
    updated_at: string
    last_entry_id: number
  }
  feeds: Array<{
    created_at: string
    entry_id: number
    field1?: string
    field2?: string
    field3?: string
    field4?: string
  }>
}

interface PublicChannel {
  id: number
  name: string
  description: string
  tags: Array<{ name: string }>
  last_entry_id: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.thingspeak.com'
const API_KEY = process.env.THINGSPEAK_API_KEY || ''

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ThingSpeak API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateField(field: number): void {
  if (field < 1 || field > 8 || !Number.isInteger(field)) {
    throw new Error('Field must be an integer between 1 and 8')
  }
}

function validateResults(results?: number): number {
  if (results === undefined) return 10
  if (results < 1 || results > 8000) throw new Error('Results must be between 1 and 8000')
  return results
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'thingspeak' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_channel(id: number, results?: number): Promise<ChannelFeed> {
  if (!id || typeof id !== 'number') throw new Error('Channel ID is required and must be a number')
  const limit = validateResults(results)
  return sg.wrap('get_channel', async () => {
    const params = new URLSearchParams({ results: String(limit) })
    if (API_KEY) params.set('api_key', API_KEY)
    return fetchJSON<ChannelFeed>(\`\${API}/channels/\${id}/feeds.json?\${params}\`)
  })
}

export async function get_field(channel_id: number, field: number, results?: number): Promise<ChannelFeed> {
  if (!channel_id || typeof channel_id !== 'number') throw new Error('Channel ID is required')
  validateField(field)
  const limit = validateResults(results)
  return sg.wrap('get_field', async () => {
    const params = new URLSearchParams({ results: String(limit) })
    if (API_KEY) params.set('api_key', API_KEY)
    return fetchJSON<ChannelFeed>(\`\${API}/channels/\${channel_id}/fields/\${field}.json?\${params}\`)
  })
}

export async function list_public(tag?: string): Promise<PublicChannel[]> {
  return sg.wrap('list_public', async () => {
    const params = new URLSearchParams()
    if (tag) params.set('tag', tag.trim())
    return fetchJSON<PublicChannel[]>(\`\${API}/channels/public.json?\${params}\`)
  })
}

console.log('settlegrid-thingspeak MCP server loaded')
`
})

// ─── 162. particle ────────────────────────────────────────────────────────
gen({
  slug: 'particle',
  title: 'Particle IoT Devices',
  desc: 'Access Particle IoT device data, variables, and diagnostics. Free access token required.',
  api: { base: 'https://api.particle.io/v1', name: 'Particle', docs: 'https://docs.particle.io/reference/cloud-apis/api/' },
  key: { env: 'PARTICLE_ACCESS_TOKEN', url: 'https://particle.io', required: true },
  keywords: ['iot', 'particle', 'devices', 'embedded', 'hardware'],
  methods: [
    { name: 'list_devices', display: 'List all devices on account', cost: 1, params: '', inputs: [] },
    { name: 'get_device', display: 'Get device info and status', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Particle device ID or name' },
    ]},
    { name: 'get_variable', display: 'Read a device variable', cost: 1, params: 'device_id, variable', inputs: [
      { name: 'device_id', type: 'string', required: true, desc: 'Device ID or name' },
      { name: 'variable', type: 'string', required: true, desc: 'Variable name exposed by firmware' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-particle — Particle IoT Devices MCP Server
 * Wraps the Particle Cloud API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ParticleDevice {
  id: string
  name: string
  platform_id: number
  product_id: number
  connected: boolean
  last_heard: string
  last_ip_address: string
  status: string
  cellular: boolean
  notes: string
  functions: string[]
  variables: Record<string, string>
}

interface DeviceVariable {
  name: string
  result: string | number | boolean
  coreInfo: {
    deviceID: string
    connected: boolean
    last_heard: string
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.particle.io/v1'
const TOKEN = process.env.PARTICLE_ACCESS_TOKEN
if (!TOKEN) throw new Error('PARTICLE_ACCESS_TOKEN environment variable is required')

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API}\${path}\`, {
    headers: { Authorization: \`Bearer \${TOKEN}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Particle API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Device ID or name is required')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'particle' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function list_devices(): Promise<ParticleDevice[]> {
  return sg.wrap('list_devices', async () => {
    return fetchJSON<ParticleDevice[]>('/devices')
  })
}

export async function get_device(id: string): Promise<ParticleDevice> {
  const deviceId = validateId(id)
  return sg.wrap('get_device', async () => {
    return fetchJSON<ParticleDevice>(\`/devices/\${deviceId}\`)
  })
}

export async function get_variable(device_id: string, variable: string): Promise<DeviceVariable> {
  const deviceId = validateId(device_id)
  const varName = variable.trim()
  if (!varName) throw new Error('Variable name is required')
  return sg.wrap('get_variable', async () => {
    return fetchJSON<DeviceVariable>(\`/devices/\${deviceId}/\${varName}\`)
  })
}

console.log('settlegrid-particle MCP server loaded')
`
})

// ─── 163. adafruit-io ─────────────────────────────────────────────────────
gen({
  slug: 'adafruit-io',
  title: 'Adafruit IO Feeds',
  desc: 'Access Adafruit IO data feeds, dashboards, and IoT data streams. Free API key required.',
  api: { base: 'https://io.adafruit.com/api/v2', name: 'Adafruit IO', docs: 'https://io.adafruit.com/api/docs/' },
  key: { env: 'ADAFRUIT_IO_KEY', url: 'https://io.adafruit.com', required: true },
  keywords: ['iot', 'adafruit', 'feeds', 'sensors', 'data-streams'],
  methods: [
    { name: 'get_feed', display: 'Get feed details and metadata', cost: 1, params: 'username, feed', inputs: [
      { name: 'username', type: 'string', required: true, desc: 'Adafruit IO username' },
      { name: 'feed', type: 'string', required: true, desc: 'Feed key or name' },
    ]},
    { name: 'get_data', display: 'Get data points from a feed', cost: 1, params: 'username, feed, limit?', inputs: [
      { name: 'username', type: 'string', required: true, desc: 'Adafruit IO username' },
      { name: 'feed', type: 'string', required: true, desc: 'Feed key or name' },
      { name: 'limit', type: 'number', required: false, desc: 'Number of data points to return (default: 10)' },
    ]},
    { name: 'list_feeds', display: 'List all feeds for a user', cost: 1, params: 'username', inputs: [
      { name: 'username', type: 'string', required: true, desc: 'Adafruit IO username' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-adafruit-io — Adafruit IO Feeds MCP Server
 * Wraps the Adafruit IO API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Feed {
  id: number
  key: string
  name: string
  description: string
  unit_type: string
  unit_symbol: string
  last_value: string
  status: string
  created_at: string
  updated_at: string
}

interface DataPoint {
  id: string
  value: string
  feed_id: number
  feed_key: string
  created_at: string
  created_epoch: number
  expiration: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://io.adafruit.com/api/v2'
const IO_KEY = process.env.ADAFRUIT_IO_KEY
if (!IO_KEY) throw new Error('ADAFRUIT_IO_KEY environment variable is required')

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API}\${path}\`, {
    headers: { 'X-AIO-Key': IO_KEY! },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Adafruit IO API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateStr(val: string, label: string): string {
  const trimmed = val.trim()
  if (!trimmed) throw new Error(\`\${label} is required\`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'adafruit-io' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_feed(username: string, feed: string): Promise<Feed> {
  const user = validateStr(username, 'Username')
  const feedKey = validateStr(feed, 'Feed key')
  return sg.wrap('get_feed', async () => {
    return fetchJSON<Feed>(\`/\${user}/feeds/\${feedKey}\`)
  })
}

export async function get_data(username: string, feed: string, limit?: number): Promise<DataPoint[]> {
  const user = validateStr(username, 'Username')
  const feedKey = validateStr(feed, 'Feed key')
  const lim = limit ?? 10
  if (lim < 1 || lim > 1000) throw new Error('Limit must be between 1 and 1000')
  return sg.wrap('get_data', async () => {
    return fetchJSON<DataPoint[]>(\`/\${user}/feeds/\${feedKey}/data?limit=\${lim}\`)
  })
}

export async function list_feeds(username: string): Promise<Feed[]> {
  const user = validateStr(username, 'Username')
  return sg.wrap('list_feeds', async () => {
    return fetchJSON<Feed[]>(\`/\${user}/feeds\`)
  })
}

console.log('settlegrid-adafruit-io MCP server loaded')
`
})

// ─── 164. openiot ─────────────────────────────────────────────────────────
gen({
  slug: 'openiot',
  title: 'Open IoT Platform',
  desc: 'Access ThingsBoard demo IoT platform for device telemetry, attributes, and management. No API key needed.',
  api: { base: 'https://demo.thingsboard.io/api', name: 'ThingsBoard', docs: 'https://thingsboard.io/docs/api/' },
  key: null,
  keywords: ['iot', 'thingsboard', 'telemetry', 'devices', 'open-source'],
  methods: [
    { name: 'list_devices', display: 'List devices with optional type filter', cost: 1, params: 'type?', inputs: [
      { name: 'type', type: 'string', required: false, desc: 'Device type to filter by' },
    ]},
    { name: 'get_telemetry', display: 'Get device telemetry data', cost: 1, params: 'device_id, keys?', inputs: [
      { name: 'device_id', type: 'string', required: true, desc: 'ThingsBoard device ID (UUID)' },
      { name: 'keys', type: 'string', required: false, desc: 'Comma-separated telemetry keys to retrieve' },
    ]},
    { name: 'get_attributes', display: 'Get device attributes', cost: 1, params: 'device_id', inputs: [
      { name: 'device_id', type: 'string', required: true, desc: 'ThingsBoard device ID (UUID)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-openiot — Open IoT Platform MCP Server
 * Wraps the ThingsBoard demo API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TbDevice {
  id: { id: string; entityType: string }
  name: string
  type: string
  label: string
  createdTime: number
  additionalInfo: Record<string, unknown>
}

interface TbDeviceList {
  data: TbDevice[]
  totalPages: number
  totalElements: number
}

interface TelemetryValue {
  ts: number
  value: string
}

interface AttributeKv {
  key: string
  value: unknown
  lastUpdateTs: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://demo.thingsboard.io/api'
const DEMO_TOKEN_URL = \`\${API}/auth/login\`
let authToken: string | null = null

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  if (authToken) return authToken
  const res = await fetch(DEMO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tenant@thingsboard.org', password: 'tenant' }),
  })
  if (!res.ok) throw new Error(\`ThingsBoard auth failed: \${res.status}\`)
  const data = await res.json() as { token: string }
  authToken = data.token
  return authToken
}

async function fetchJSON<T>(path: string): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(\`\${API}\${path}\`, {
    headers: { 'X-Authorization': \`Bearer \${token}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ThingsBoard API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateUUID(id: string): string {
  const trimmed = id.trim()
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) throw new Error(\`Invalid UUID: \${id}\`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'openiot' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function list_devices(type?: string): Promise<TbDevice[]> {
  return sg.wrap('list_devices', async () => {
    const params = new URLSearchParams({ pageSize: '20', page: '0' })
    if (type) params.set('type', type.trim())
    const result = await fetchJSON<TbDeviceList>(\`/tenant/devices?\${params}\`)
    return result.data
  })
}

export async function get_telemetry(device_id: string, keys?: string): Promise<Record<string, TelemetryValue[]>> {
  const id = validateUUID(device_id)
  return sg.wrap('get_telemetry', async () => {
    const params = new URLSearchParams()
    if (keys) params.set('keys', keys.trim())
    return fetchJSON<Record<string, TelemetryValue[]>>(
      \`/plugins/telemetry/DEVICE/\${id}/values/timeseries?\${params}\`
    )
  })
}

export async function get_attributes(device_id: string): Promise<AttributeKv[]> {
  const id = validateUUID(device_id)
  return sg.wrap('get_attributes', async () => {
    return fetchJSON<AttributeKv[]>(\`/plugins/telemetry/DEVICE/\${id}/values/attributes\`)
  })
}

console.log('settlegrid-openiot MCP server loaded')
`
})

// ─── 165. sensor-community ────────────────────────────────────────────────
gen({
  slug: 'sensor-community',
  title: 'Sensor.Community Air Quality',
  desc: 'Access citizen-operated air quality sensor data from the Sensor.Community network. No API key needed.',
  api: { base: 'https://data.sensor.community/airrohr/v1', name: 'Sensor.Community', docs: 'https://github.com/opendata-stuttgart/meta/wiki/APIs' },
  key: null,
  keywords: ['air-quality', 'sensors', 'particulate-matter', 'environment', 'citizen-science'],
  methods: [
    { name: 'get_readings', display: 'Get latest sensor readings', cost: 1, params: 'sensor_id', inputs: [
      { name: 'sensor_id', type: 'number', required: true, desc: 'Sensor ID number' },
    ]},
    { name: 'get_area', display: 'Get sensors in a geographic area', cost: 2, params: 'lat, lon, radius?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude of center point' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude of center point' },
      { name: 'radius', type: 'number', required: false, desc: 'Radius in km (default: 10)' },
    ]},
    { name: 'get_averages', display: 'Get 24h average readings', cost: 1, params: 'sensor_id', inputs: [
      { name: 'sensor_id', type: 'number', required: true, desc: 'Sensor ID number' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Sensor.Community API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(\`\${name} must be a valid number\`)
  if (val < min || val > max) throw new Error(\`\${name} must be between \${min} and \${max}\`)
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
    return fetchJSON<SensorReading[]>(\`\${API}/sensor/\${id}/\`)
  })
}

export async function get_area(lat: number, lon: number, radius?: number): Promise<AreaResult> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const r = radius ?? 10
  if (r < 1 || r > 100) throw new Error('Radius must be between 1 and 100 km')
  return sg.wrap('get_area', async () => {
    const data = await fetchJSON<SensorReading[]>(
      \`\${API}/filter/area=\${validLat},\${validLon},\${r}\`
    )
    return { sensors: data, count: data.length, center: { lat: validLat, lon: validLon }, radius_km: r }
  })
}

export async function get_averages(sensor_id: number): Promise<SensorReading[]> {
  const id = validateSensorId(sensor_id)
  return sg.wrap('get_averages', async () => {
    return fetchJSON<SensorReading[]>(\`\${API}/sensor/\${id}/\`)
  })
}

console.log('settlegrid-sensor-community MCP server loaded')
`
})

// ─── 166. purpleair ───────────────────────────────────────────────────────
gen({
  slug: 'purpleair',
  title: 'PurpleAir Sensors',
  desc: 'Access PurpleAir air quality sensor network data with real-time PM2.5, temperature, and humidity. Free API key required.',
  api: { base: 'https://api.purpleair.com/v1', name: 'PurpleAir', docs: 'https://api.purpleair.com/' },
  key: { env: 'PURPLEAIR_API_KEY', url: 'https://develop.purpleair.com', required: true },
  keywords: ['air-quality', 'purpleair', 'pm25', 'sensors', 'environment'],
  methods: [
    { name: 'get_sensor', display: 'Get a single sensor by index', cost: 1, params: 'sensor_index', inputs: [
      { name: 'sensor_index', type: 'number', required: true, desc: 'PurpleAir sensor index number' },
    ]},
    { name: 'get_sensors', display: 'Get sensors near a location', cost: 2, params: 'lat, lon, radius?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude of center point' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude of center point' },
      { name: 'radius', type: 'number', required: false, desc: 'Search radius in km (default: 5, max: 50)' },
    ]},
    { name: 'get_history', display: 'Get sensor history data', cost: 2, params: 'sensor_index, days?', inputs: [
      { name: 'sensor_index', type: 'number', required: true, desc: 'PurpleAir sensor index number' },
      { name: 'days', type: 'number', required: false, desc: 'Number of days of history (default: 1, max: 14)' },
    ]},
  ],
  serverTs: `/**
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
  const qs = params ? \`?\${params}\` : ''
  const res = await fetch(\`\${API}\${path}\${qs}\`, {
    headers: { 'X-API-Key': API_KEY! },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`PurpleAir API error: \${res.status} \${res.statusText} \${body}\`)
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
    return fetchJSON<PaSensorResponse>(\`/sensors/\${idx}\`, params)
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
    return fetchJSON<PaHistoryResponse>(\`/sensors/\${idx}/history\`, params)
  })
}

console.log('settlegrid-purpleair MCP server loaded')
`
})

// ─── 167. smart-citizen ───────────────────────────────────────────────────
gen({
  slug: 'smart-citizen',
  title: 'Smart Citizen Sensors',
  desc: 'Access Smart Citizen Kit sensor data for environmental monitoring. Open API, no key needed.',
  api: { base: 'https://api.smartcitizen.me/v0', name: 'Smart Citizen', docs: 'https://developer.smartcitizen.me/' },
  key: null,
  keywords: ['sensors', 'smart-citizen', 'environment', 'citizen-science', 'air-quality'],
  methods: [
    { name: 'get_device', display: 'Get device info and latest readings', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'number', required: true, desc: 'Smart Citizen device ID' },
    ]},
    { name: 'list_devices', display: 'List devices optionally filtered by city', cost: 1, params: 'city?', inputs: [
      { name: 'city', type: 'string', required: false, desc: 'City name to filter devices' },
    ]},
    { name: 'get_readings', display: 'Get historical sensor readings', cost: 2, params: 'device_id, sensor_id?', inputs: [
      { name: 'device_id', type: 'number', required: true, desc: 'Smart Citizen device ID' },
      { name: 'sensor_id', type: 'number', required: false, desc: 'Specific sensor ID on the device' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Smart Citizen API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateId(id: number, label: string): number {
  if (!id || typeof id !== 'number' || id <= 0) throw new Error(\`\${label} must be a positive number\`)
  return Math.floor(id)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'smart-citizen' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_device(id: number): Promise<ScDevice> {
  const deviceId = validateId(id, 'Device ID')
  return sg.wrap('get_device', async () => {
    return fetchJSON<ScDevice>(\`\${API}/devices/\${deviceId}\`)
  })
}

export async function list_devices(city?: string): Promise<ScDevice[]> {
  return sg.wrap('list_devices', async () => {
    const params = new URLSearchParams({ per_page: '25' })
    if (city) params.set('city', city.trim())
    return fetchJSON<ScDevice[]>(\`\${API}/devices?\${params}\`)
  })
}

export async function get_readings(device_id: number, sensor_id?: number): Promise<{ readings: ScReading[]; device_id: number }> {
  const devId = validateId(device_id, 'Device ID')
  return sg.wrap('get_readings', async () => {
    let url = \`\${API}/devices/\${devId}/readings?rollup=1h&limit=24\`
    if (sensor_id) {
      const sId = validateId(sensor_id, 'Sensor ID')
      url += \`&sensor_id=\${sId}\`
    }
    const data = await fetchJSON<{ readings: ScReading[] }>(url)
    return { ...data, device_id: devId }
  })
}

console.log('settlegrid-smart-citizen MCP server loaded')
`
})

// ─── 168. arduino-cloud ───────────────────────────────────────────────────
gen({
  slug: 'arduino-cloud',
  title: 'Arduino IoT Cloud',
  desc: 'Access Arduino IoT Cloud things, properties, and device data. Free account with API access.',
  api: { base: 'https://api2.arduino.cc/iot/v2', name: 'Arduino IoT Cloud', docs: 'https://www.arduino.cc/reference/en/iot/api/' },
  key: { env: 'ARDUINO_CLIENT_ID', url: 'https://cloud.arduino.cc', required: true },
  keywords: ['arduino', 'iot', 'cloud', 'devices', 'hardware'],
  methods: [
    { name: 'list_things', display: 'List all Arduino things', cost: 1, params: '', inputs: [] },
    { name: 'get_thing', display: 'Get thing details by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Arduino thing UUID' },
    ]},
    { name: 'get_properties', display: 'Get thing properties and values', cost: 1, params: 'thing_id', inputs: [
      { name: 'thing_id', type: 'string', required: true, desc: 'Arduino thing UUID' },
    ]},
  ],
  serverTs: `/**
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
  if (!res.ok) throw new Error(\`Arduino auth failed: \${res.status}\`)
  const data = await res.json() as { access_token: string; expires_in: number }
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return accessToken
}

async function fetchJSON<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(\`\${API}\${path}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Arduino API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateUUID(id: string, label: string): string {
  const trimmed = id.trim()
  if (!trimmed) throw new Error(\`\${label} is required\`)
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
    return fetchJSON<ArduinoThing>(\`/things/\${thingId}\`)
  })
}

export async function get_properties(thing_id: string): Promise<ArduinoProperty[]> {
  const thingId = validateUUID(thing_id, 'Thing ID')
  return sg.wrap('get_properties', async () => {
    return fetchJSON<ArduinoProperty[]>(\`/things/\${thingId}/properties\`)
  })
}

console.log('settlegrid-arduino-cloud MCP server loaded')
`
})

// ─── 169. iss-tracker ─────────────────────────────────────────────────────
gen({
  slug: 'iss-tracker',
  title: 'ISS Tracker',
  desc: 'Track the International Space Station position, crew, and overhead passes. No API key needed.',
  api: { base: 'http://api.open-notify.org', name: 'Open Notify', docs: 'http://open-notify.org/Open-Notify-API/' },
  key: null,
  keywords: ['iss', 'space', 'satellite', 'tracking', 'nasa'],
  methods: [
    { name: 'get_position', display: 'Get current ISS position', cost: 1, params: '', inputs: [] },
    { name: 'get_crew', display: 'Get current ISS crew', cost: 1, params: '', inputs: [] },
    { name: 'get_passes', display: 'Get upcoming overhead passes', cost: 1, params: 'lat, lon, count?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Observer latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Observer longitude' },
      { name: 'count', type: 'number', required: false, desc: 'Number of passes to return (default: 5)' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Open Notify API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(\`\${name} must be a valid number\`)
  if (val < min || val > max) throw new Error(\`\${name} must be between \${min} and \${max}\`)
  return val
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'iss-tracker' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_position(): Promise<FormattedPosition> {
  return sg.wrap('get_position', async () => {
    const data = await fetchJSON<IssPosition>(\`\${API}/iss-now.json\`)
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
    const data = await fetchJSON<IssCrew>(\`\${API}/astros.json\`)
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
      \`\${API}/iss-pass.json?lat=\${validLat}&lon=\${validLon}&n=\${n}\`
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
`
})

// ─── 170. ham-radio ───────────────────────────────────────────────────────
gen({
  slug: 'ham-radio',
  title: 'Ham Radio Callsign Lookup',
  desc: 'Look up amateur radio callsigns, licensee data, and DXCC entities via Callook. No API key needed.',
  api: { base: 'https://callook.info', name: 'Callook', docs: 'https://callook.info/api.php' },
  key: null,
  keywords: ['ham-radio', 'amateur-radio', 'callsign', 'fcc', 'dxcc'],
  methods: [
    { name: 'lookup_callsign', display: 'Look up a callsign', cost: 1, params: 'callsign', inputs: [
      { name: 'callsign', type: 'string', required: true, desc: 'Amateur radio callsign (e.g., W1AW)' },
    ]},
    { name: 'search_callsigns', display: 'Search callsigns by query', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or partial callsign to search for' },
    ]},
    { name: 'get_dxcc', display: 'Get DXCC entity info', cost: 1, params: 'entity', inputs: [
      { name: 'entity', type: 'string', required: true, desc: 'DXCC entity number or prefix' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ham-radio — Ham Radio Callsign Lookup MCP Server
 * Wraps the Callook API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CallsignResult {
  status: string
  type: string
  current: {
    callsign: string
    operClass: string
  }
  previous: {
    callsign: string
    operClass: string
  }
  name: string
  address: {
    line1: string
    line2: string
    attn: string
  }
  location: {
    latitude: string
    longitude: string
    gridsquare: string
  }
  otherInfo: {
    grantDate: string
    expiryDate: string
    lastActionDate: string
    frn: string
    ulsUrl: string
  }
}

interface DxccEntity {
  status: string
  name: string
  dxcc: number
  cqzone: number
  ituzone: number
  continent: string
  prefix: string
  utc_offset: number
}

interface SearchResult {
  callsign: string
  name: string
  operClass: string
  state: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://callook.info'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Callook API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateCallsign(cs: string): string {
  const upper = cs.trim().toUpperCase()
  if (!upper || upper.length < 3 || upper.length > 10) {
    throw new Error('Callsign must be between 3 and 10 characters')
  }
  if (!/^[A-Z0-9\\/]+$/.test(upper)) {
    throw new Error('Callsign contains invalid characters')
  }
  return upper
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed || trimmed.length < 2) throw new Error('Query must be at least 2 characters')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ham-radio' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function lookup_callsign(callsign: string): Promise<CallsignResult> {
  const cs = validateCallsign(callsign)
  return sg.wrap('lookup_callsign', async () => {
    return fetchJSON<CallsignResult>(\`\${API}/\${cs}/json\`)
  })
}

export async function search_callsigns(query: string): Promise<SearchResult[]> {
  const q = validateQuery(query)
  return sg.wrap('search_callsigns', async () => {
    const data = await fetchJSON<{ results: SearchResult[] }>(\`\${API}/search/\${encodeURIComponent(q)}/json\`)
    return data.results || []
  })
}

export async function get_dxcc(entity: string): Promise<DxccEntity> {
  const e = entity.trim()
  if (!e) throw new Error('DXCC entity number or prefix is required')
  return sg.wrap('get_dxcc', async () => {
    return fetchJSON<DxccEntity>(\`\${API}/dxcc/\${encodeURIComponent(e)}/json\`)
  })
}

console.log('settlegrid-ham-radio MCP server loaded')
`
})

// ─── 171. adsb-data ───────────────────────────────────────────────────────
gen({
  slug: 'adsb-data',
  title: 'Aircraft ADS-B Data',
  desc: 'Access real-time aircraft tracking data via the OpenSky Network. No API key needed for basic access.',
  api: { base: 'https://opensky-network.org/api', name: 'OpenSky Network', docs: 'https://openskynetwork.github.io/opensky-api/' },
  key: null,
  keywords: ['adsb', 'aircraft', 'aviation', 'flight-tracking', 'opensky'],
  methods: [
    { name: 'get_states', display: 'Get aircraft state vectors', cost: 2, params: 'lat?, lon?, radius?', inputs: [
      { name: 'lat', type: 'number', required: false, desc: 'Center latitude for bounding box' },
      { name: 'lon', type: 'number', required: false, desc: 'Center longitude for bounding box' },
      { name: 'radius', type: 'number', required: false, desc: 'Radius in degrees (default: 1)' },
    ]},
    { name: 'get_flights', display: 'Get flight history for aircraft', cost: 2, params: 'icao24, begin?, end?', inputs: [
      { name: 'icao24', type: 'string', required: true, desc: 'ICAO24 transponder address (hex)' },
      { name: 'begin', type: 'number', required: false, desc: 'Start time as Unix timestamp' },
      { name: 'end', type: 'number', required: false, desc: 'End time as Unix timestamp' },
    ]},
    { name: 'get_track', display: 'Get aircraft track waypoints', cost: 2, params: 'icao24', inputs: [
      { name: 'icao24', type: 'string', required: true, desc: 'ICAO24 transponder address (hex)' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`OpenSky API error: \${res.status} \${res.statusText} \${body}\`)
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
    const data = await fetchJSON<StatesResponse>(\`\${API}/states/all\${qs ? '?' + qs : ''}\`)
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
    return fetchJSON<Flight[]>(\`\${API}/flights/aircraft?icao24=\${icao}&begin=\${b}&end=\${e}\`)
  })
}

export async function get_track(icao24: string): Promise<Track> {
  const icao = validateIcao24(icao24)
  return sg.wrap('get_track', async () => {
    return fetchJSON<Track>(\`\${API}/tracks/all?icao24=\${icao}&time=0\`)
  })
}

console.log('settlegrid-adsb-data MCP server loaded')
`
})

// ─── 172. ais-data ────────────────────────────────────────────────────────
gen({
  slug: 'ais-data',
  title: 'Ship AIS Data',
  desc: 'Access ship AIS tracking data from the Finnish Digitraffic marine API. Free and open, no API key needed.',
  api: { base: 'https://meri.digitraffic.fi/api/v1', name: 'Digitraffic Marine', docs: 'https://www.digitraffic.fi/en/marine/' },
  key: null,
  keywords: ['ais', 'ships', 'marine', 'vessel-tracking', 'maritime'],
  methods: [
    { name: 'get_vessels', display: 'Get vessels near a location', cost: 2, params: 'lat, lon, radius?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Center latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Center longitude' },
      { name: 'radius', type: 'number', required: false, desc: 'Search radius in km (default: 20)' },
    ]},
    { name: 'get_vessel', display: 'Get vessel details by MMSI', cost: 1, params: 'mmsi', inputs: [
      { name: 'mmsi', type: 'number', required: true, desc: 'Maritime Mobile Service Identity number' },
    ]},
    { name: 'get_port', display: 'Get port information by locode', cost: 1, params: 'locode', inputs: [
      { name: 'locode', type: 'string', required: true, desc: 'UN/LOCODE port code (e.g., FIHEL)' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Digitraffic API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(\`\${name} must be a valid number\`)
  if (val < min || val > max) throw new Error(\`\${name} must be between \${min} and \${max}\`)
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
      \`\${API}/locations/latest?from=\${validLat - r / 111}&to=\${validLon - r / 111}\`
    )
    const vessels = (data.features || []).slice(0, 50)
    return { vessels, count: vessels.length }
  })
}

export async function get_vessel(mmsi: number): Promise<VesselMetadata> {
  const id = validateMmsi(mmsi)
  return sg.wrap('get_vessel', async () => {
    return fetchJSON<VesselMetadata>(\`\${API}/metadata/vessels/\${id}\`)
  })
}

export async function get_port(locode: string): Promise<PortInfo> {
  const code = locode.trim().toUpperCase()
  if (!code || code.length < 4 || code.length > 6) throw new Error('LOCODE must be 4-6 characters (e.g., FIHEL)')
  return sg.wrap('get_port', async () => {
    return fetchJSON<PortInfo>(\`\${API}/metadata/ports/\${code}\`)
  })
}

console.log('settlegrid-ais-data MCP server loaded')
`
})

// ─── 173. radio-browser ──────────────────────────────────────────────────
gen({
  slug: 'radio-browser',
  title: 'Internet Radio Browser',
  desc: 'Search and discover internet radio stations worldwide via the Radio Browser API. No API key needed.',
  api: { base: 'https://de1.api.radio-browser.info', name: 'Radio Browser', docs: 'https://de1.api.radio-browser.info/' },
  key: null,
  keywords: ['radio', 'streaming', 'music', 'stations', 'internet-radio'],
  methods: [
    { name: 'search_stations', display: 'Search radio stations', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term for station name, tag, or country' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results to return (default: 20, max: 100)' },
    ]},
    { name: 'get_top', display: 'Get top-voted stations', cost: 1, params: 'limit?, country?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of top stations (default: 20)' },
      { name: 'country', type: 'string', required: false, desc: 'Filter by country name' },
    ]},
    { name: 'list_countries', display: 'List countries with station counts', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-radio-browser — Internet Radio Browser MCP Server
 * Wraps the Radio Browser API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RadioStation {
  changeuuid: string
  stationuuid: string
  name: string
  url: string
  url_resolved: string
  homepage: string
  favicon: string
  tags: string
  country: string
  countrycode: string
  state: string
  language: string
  languagecodes: string
  votes: number
  lastchangetime: string
  codec: string
  bitrate: number
  hls: number
  lastcheckok: number
  clickcount: number
  clicktrend: number
  geo_lat: number | null
  geo_long: number | null
}

interface CountryInfo {
  name: string
  iso_3166_1: string
  stationcount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://de1.api.radio-browser.info/json'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-radio-browser/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Radio Browser API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateLimit(limit?: number, max = 100): number {
  if (limit === undefined) return 20
  if (limit < 1 || limit > max) throw new Error(\`Limit must be between 1 and \${max}\`)
  return Math.floor(limit)
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Search query is required')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'radio-browser' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function search_stations(query: string, limit?: number): Promise<RadioStation[]> {
  const q = validateQuery(query)
  const lim = validateLimit(limit)
  return sg.wrap('search_stations', async () => {
    const params = new URLSearchParams({
      name: q, limit: String(lim), order: 'votes', reverse: 'true', hidebroken: 'true',
    })
    return fetchJSON<RadioStation[]>(\`\${API}/stations/search?\${params}\`)
  })
}

export async function get_top(limit?: number, country?: string): Promise<RadioStation[]> {
  const lim = validateLimit(limit)
  return sg.wrap('get_top', async () => {
    const params = new URLSearchParams({ limit: String(lim), hidebroken: 'true' })
    if (country) params.set('country', country.trim())
    return fetchJSON<RadioStation[]>(\`\${API}/stations/topvote?\${params}\`)
  })
}

export async function list_countries(): Promise<CountryInfo[]> {
  return sg.wrap('list_countries', async () => {
    const params = new URLSearchParams({ order: 'stationcount', reverse: 'true' })
    return fetchJSON<CountryInfo[]>(\`\${API}/countries?\${params}\`)
  })
}

console.log('settlegrid-radio-browser MCP server loaded')
`
})

// ─── 174. cell-tower ──────────────────────────────────────────────────────
gen({
  slug: 'cell-tower',
  title: 'Cell Tower Locations',
  desc: 'Look up cell tower locations and coverage data using public cell tower databases. No API key needed.',
  api: { base: 'https://opencellid.org', name: 'OpenCelliD', docs: 'https://wiki.opencellid.org/wiki/API' },
  key: null,
  keywords: ['cell-tower', 'mobile', 'coverage', 'telecom', 'location'],
  methods: [
    { name: 'get_tower', display: 'Get cell tower location by identifiers', cost: 1, params: 'mcc, mnc, lac, cellid', inputs: [
      { name: 'mcc', type: 'number', required: true, desc: 'Mobile Country Code' },
      { name: 'mnc', type: 'number', required: true, desc: 'Mobile Network Code' },
      { name: 'lac', type: 'number', required: true, desc: 'Location Area Code' },
      { name: 'cellid', type: 'number', required: true, desc: 'Cell ID' },
    ]},
    { name: 'search_area', display: 'Search cell towers in an area', cost: 2, params: 'lat, lon, radius?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Center latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Center longitude' },
      { name: 'radius', type: 'number', required: false, desc: 'Search radius in km (default: 5)' },
    ]},
    { name: 'get_stats', display: 'Get cell tower statistics', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country code (e.g., US, DE) to filter stats' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Cell tower API error: \${res.status} \${res.statusText} \${body}\`)
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
    throw new Error(\`\${label} must be a non-negative number\`)
  }
  return Math.floor(val)
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(\`\${name} must be a valid number\`)
  if (val < min || val > max) throw new Error(\`\${name} must be between \${min} and \${max}\`)
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
    return fetchJSON<CellTower>(\`\${API}/cell/get?\${params}\`)
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
    const data = await fetchJSON<{ cells: CellTower[] }>(\`\${API}/cell/getInArea?\${params}\`)
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
    const data = await fetchJSON<CellStats>(\`\${API}/cell/stats?\${params}\`)
    return { ...data, country: country?.toUpperCase() }
  })
}

console.log('settlegrid-cell-tower MCP server loaded')
`
})

// ─── 175. wifi-data ───────────────────────────────────────────────────────
gen({
  slug: 'wifi-data',
  title: 'WiFi Network Data',
  desc: 'Search and explore WiFi network data from public wireless network databases. No API key needed.',
  api: { base: 'https://api.wigle.net/api/v2', name: 'WiGLE', docs: 'https://api.wigle.net/swagger' },
  key: null,
  keywords: ['wifi', 'wireless', 'networks', 'wardriving', 'location'],
  methods: [
    { name: 'search_networks', display: 'Search WiFi networks near a location', cost: 2, params: 'lat, lon, radius?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Center latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Center longitude' },
      { name: 'radius', type: 'number', required: false, desc: 'Search radius in km (default: 1)' },
    ]},
    { name: 'get_stats', display: 'Get WiFi network statistics', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country code to filter stats (e.g., US)' },
    ]},
    { name: 'get_network', display: 'Get network details by BSSID', cost: 1, params: 'bssid', inputs: [
      { name: 'bssid', type: 'string', required: true, desc: 'WiFi BSSID/MAC address (e.g., 00:11:22:33:44:55)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-wifi-data — WiFi Network Data MCP Server
 * Wraps public WiFi network databases with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface WiFiNetwork {
  trilat: number
  trilong: number
  ssid: string
  qos: number
  transid: string
  firsttime: string
  lasttime: string
  lastupdt: string
  netid: string
  name: string
  type: string
  comment: string
  wep: string
  channel: number
  bcninterval: number
  freenet: string
  dhcp: string
  paynet: string
  userfound: boolean
  encryption: string
  city: string
  region: string
  country: string
  housenumber: string
  road: string
  postalcode: string
}

interface SearchResult {
  networks: WiFiNetwork[]
  count: number
  center: { lat: number; lon: number }
  radius_km: number
}

interface WiFiStats {
  totalNetworks: number
  totalDiscovered: number
  country?: string
  lastUpdated: string
}

interface NetworkDetail {
  bssid: string
  ssid: string
  encryption: string
  channel: number
  latitude: number
  longitude: number
  city: string
  country: string
  firstSeen: string
  lastSeen: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.wigle.net/api/v2'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'settlegrid-wifi-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WiFi data API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(\`\${name} must be a valid number\`)
  if (val < min || val > max) throw new Error(\`\${name} must be between \${min} and \${max}\`)
  return val
}

function validateBssid(bssid: string): string {
  const trimmed = bssid.trim().toUpperCase()
  if (!/^([0-9A-F]{2}[:\\-]){5}[0-9A-F]{2}$/.test(trimmed)) {
    throw new Error('BSSID must be in format XX:XX:XX:XX:XX:XX')
  }
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'wifi-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function search_networks(lat: number, lon: number, radius?: number): Promise<SearchResult> {
  const validLat = validateCoord(lat, 'Latitude', -90, 90)
  const validLon = validateCoord(lon, 'Longitude', -180, 180)
  const r = radius ?? 1
  if (r < 0.01 || r > 10) throw new Error('Radius must be between 0.01 and 10 km')
  return sg.wrap('search_networks', async () => {
    const degOffset = r / 111
    const params = new URLSearchParams({
      latrange1: String(validLat - degOffset), latrange2: String(validLat + degOffset),
      longrange1: String(validLon - degOffset), longrange2: String(validLon + degOffset),
      resultsPerPage: '50',
    })
    const data = await fetchJSON<{ success: boolean; results: WiFiNetwork[]; totalResults: number }>(
      \`\${API}/network/search?\${params}\`
    )
    return {
      networks: data.results || [],
      count: (data.results || []).length,
      center: { lat: validLat, lon: validLon },
      radius_km: r,
    }
  })
}

export async function get_stats(country?: string): Promise<WiFiStats> {
  return sg.wrap('get_stats', async () => {
    const url = country
      ? \`\${API}/stats/countries?country=\${encodeURIComponent(country.trim().toUpperCase())}\`
      : \`\${API}/stats/countries\`
    const data = await fetchJSON<{ statistics: { discoveredGps: number; discoveredGpsPercent: number } }>(url)
    return {
      totalNetworks: data.statistics?.discoveredGps || 0,
      totalDiscovered: data.statistics?.discoveredGpsPercent || 0,
      country: country?.toUpperCase(),
      lastUpdated: new Date().toISOString(),
    }
  })
}

export async function get_network(bssid: string): Promise<NetworkDetail> {
  const mac = validateBssid(bssid)
  return sg.wrap('get_network', async () => {
    const params = new URLSearchParams({ netid: mac })
    const data = await fetchJSON<{ success: boolean; results: WiFiNetwork[] }>(
      \`\${API}/network/detail?\${params}\`
    )
    if (!data.results || data.results.length === 0) {
      throw new Error(\`No network found with BSSID \${mac}\`)
    }
    const net = data.results[0]
    return {
      bssid: net.netid || mac,
      ssid: net.ssid,
      encryption: net.encryption,
      channel: net.channel,
      latitude: net.trilat,
      longitude: net.trilong,
      city: net.city,
      country: net.country,
      firstSeen: net.firsttime,
      lastSeen: net.lasttime,
    }
  })
}

console.log('settlegrid-wifi-data MCP server loaded')
`
})

console.log('\n✅ Batch 3E2 complete — 15 IoT/Hardware servers generated\n')
