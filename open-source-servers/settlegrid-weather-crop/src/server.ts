/**
 * settlegrid-weather-crop — Weather Impact on Crops MCP Server
 * Wraps NWS Weather API with agricultural impact analysis via SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface WeatherCondition {
  state: string
  temperature: number | null
  precipitation: number | null
  humidity: number | null
  windSpeed: number | null
  conditions: string
  cropImpact: string | null
}

interface DroughtInfo {
  state: string
  severity: string
  affectedArea: number
  cropRisk: string
  advisories: string[]
}

interface ForecastImpact {
  lat: number
  lon: number
  periods: ForecastPeriod[]
}

interface ForecastPeriod {
  name: string
  temperature: number
  temperatureUnit: string
  windSpeed: string
  shortForecast: string
  agriculturalImpact: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const NWS_API = 'https://api.weather.gov'

const STATE_COORDS: Record<string, { lat: number; lon: number }> = {
  IA: { lat: 42.03, lon: -93.58 }, IL: { lat: 40.0, lon: -89.0 },
  KS: { lat: 38.5, lon: -98.0 }, NE: { lat: 41.5, lon: -99.8 },
  IN: { lat: 40.27, lon: -86.13 }, OH: { lat: 40.42, lon: -82.91 },
  MN: { lat: 46.39, lon: -94.64 }, SD: { lat: 44.5, lon: -100.0 },
  ND: { lat: 47.55, lon: -101.0 }, MO: { lat: 38.57, lon: -92.6 },
  WI: { lat: 44.5, lon: -89.5 }, TX: { lat: 31.97, lon: -99.9 },
  CA: { lat: 36.78, lon: -119.42 }, WA: { lat: 47.75, lon: -120.74 },
}

const CROP_TEMP_RANGES: Record<string, { min: number; max: number; optMin: number; optMax: number }> = {
  corn: { min: 50, max: 95, optMin: 60, optMax: 86 },
  wheat: { min: 37, max: 87, optMin: 55, optMax: 77 },
  soybeans: { min: 50, max: 95, optMin: 60, optMax: 85 },
  rice: { min: 50, max: 95, optMin: 68, optMax: 90 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchNWS<T>(path: string): Promise<T> {
  const res = await fetch(`${NWS_API}${path}`, {
    headers: { 'User-Agent': 'settlegrid-weather-crop/1.0', Accept: 'application/geo+json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NWS API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

function assessCropImpact(temp: number, crop: string): string {
  const range = CROP_TEMP_RANGES[crop.toLowerCase()]
  if (!range) return 'No specific crop data available'
  if (temp < range.min) return `Temperature (${temp}°F) below minimum (${range.min}°F) — risk of cold damage`
  if (temp > range.max) return `Temperature (${temp}°F) above maximum (${range.max}°F) — heat stress likely`
  if (temp >= range.optMin && temp <= range.optMax) return `Temperature (${temp}°F) optimal for ${crop} growth`
  return `Temperature (${temp}°F) within survivable range but not optimal`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'weather-crop' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getConditions(state: string, crop?: string): Promise<WeatherCondition> {
  if (!state || !state.trim()) throw new Error('State abbreviation is required')
  const stUpper = state.trim().toUpperCase()
  const coords = STATE_COORDS[stUpper]
  if (!coords) throw new Error(`State ${stUpper} not recognized. Supported: ${Object.keys(STATE_COORDS).join(', ')}`)
  return sg.wrap('get_conditions', async () => {
    const point = await fetchNWS<{ properties: { forecast: string } }>(`/points/${coords.lat},${coords.lon}`)
    const forecast = await fetchNWS<{ properties: { periods: { temperature: number; shortForecast: string; relativeHumidity?: { value: number }; windSpeed: string }[] } }>(
      point.properties.forecast.replace(NWS_API, '')
    )
    const current = forecast.properties.periods[0]
    const temp = current.temperature
    return {
      state: stUpper,
      temperature: temp,
      precipitation: null,
      humidity: current.relativeHumidity?.value || null,
      windSpeed: parseFloat(current.windSpeed) || null,
      conditions: current.shortForecast,
      cropImpact: crop ? assessCropImpact(temp, crop) : null,
    }
  })
}

async function getDroughtImpact(state: string): Promise<DroughtInfo> {
  if (!state || !state.trim()) throw new Error('State abbreviation is required')
  const stUpper = state.trim().toUpperCase()
  return sg.wrap('get_drought_impact', async () => {
    const coords = STATE_COORDS[stUpper]
    if (!coords) throw new Error(`State ${stUpper} not recognized`)
    const alerts = await fetchNWS<{ features: { properties: { headline: string; severity: string; description: string } }[] }>(`/alerts/active?area=${stUpper}`)
    const droughtAlerts = alerts.features.filter((f: { properties: { headline: string } }) =>
      f.properties.headline.toLowerCase().includes('drought') || f.properties.headline.toLowerCase().includes('dry')
    )
    return {
      state: stUpper,
      severity: droughtAlerts.length > 0 ? 'Active' : 'None',
      affectedArea: droughtAlerts.length,
      cropRisk: droughtAlerts.length > 0 ? 'Elevated — monitor irrigation needs' : 'Normal — no drought alerts',
      advisories: droughtAlerts.map((a: { properties: { headline: string } }) => a.properties.headline),
    }
  })
}

async function getForecastImpact(lat: number, lon: number): Promise<ForecastImpact> {
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90')
  if (typeof lon !== 'number' || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180')
  return sg.wrap('get_forecast_impact', async () => {
    const point = await fetchNWS<{ properties: { forecast: string } }>(`/points/${lat},${lon}`)
    const forecast = await fetchNWS<{ properties: { periods: { name: string; temperature: number; temperatureUnit: string; windSpeed: string; shortForecast: string }[] } }>(
      point.properties.forecast.replace(NWS_API, '')
    )
    const periods = forecast.properties.periods.slice(0, 7).map(p => ({
      name: p.name,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      windSpeed: p.windSpeed,
      shortForecast: p.shortForecast,
      agriculturalImpact: p.temperature < 32 ? 'Frost risk — protect sensitive crops' : p.temperature > 95 ? 'Heat stress — increase irrigation' : 'Conditions favorable for most crops',
    }))
    return { lat, lon, periods }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getConditions, getDroughtImpact, getForecastImpact }

console.log('settlegrid-weather-crop MCP server loaded')
