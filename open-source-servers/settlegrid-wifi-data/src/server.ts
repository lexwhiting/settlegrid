/**
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
    throw new Error(`WiFi data API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateCoord(val: number, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || isNaN(val)) throw new Error(`${name} must be a valid number`)
  if (val < min || val > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return val
}

function validateBssid(bssid: string): string {
  const trimmed = bssid.trim().toUpperCase()
  if (!/^([0-9A-F]{2}[:\-]){5}[0-9A-F]{2}$/.test(trimmed)) {
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
      `${API}/network/search?${params}`
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
      ? `${API}/stats/countries?country=${encodeURIComponent(country.trim().toUpperCase())}`
      : `${API}/stats/countries`
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
      `${API}/network/detail?${params}`
    )
    if (!data.results || data.results.length === 0) {
      throw new Error(`No network found with BSSID ${mac}`)
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
