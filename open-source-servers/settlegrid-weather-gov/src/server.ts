/**
 * settlegrid-weather-gov — NOAA/NWS Weather MCP Server
 *
 * Wraps the free NOAA Weather API (api.weather.gov) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_forecast(lat, lon)    — 7-day forecast for coordinates  (1¢)
 *   get_alerts(state)         — Active weather alerts by state  (1¢)
 *   get_stations(lat, lon)    — Nearby observation stations     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ForecastInput {
  lat: number
  lon: number
}

interface AlertsInput {
  state: string
}

interface StationsInput {
  lat: number
  lon: number
}

interface ForecastPeriod {
  name: string
  temperature: number
  temperatureUnit: string
  windSpeed: string
  windDirection: string
  shortForecast: string
  detailedForecast: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NWS_BASE = 'https://api.weather.gov'
const USER_AGENT = 'settlegrid-weather-gov/1.0 (contact@settlegrid.ai)'

async function nwsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${NWS_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NWS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'weather-gov',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_forecast: { costCents: 1, displayName: '7-Day Forecast' },
      get_alerts: { costCents: 1, displayName: 'Weather Alerts' },
      get_stations: { costCents: 1, displayName: 'Nearby Stations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }

  // Step 1: Resolve grid coordinates from lat/lon
  const point = await nwsFetch<{
    properties: { forecast: string }
  }>(`/points/${args.lat.toFixed(4)},${args.lon.toFixed(4)}`)

  // Step 2: Fetch forecast from the resolved URL
  const forecastUrl = point.properties.forecast
  const forecast = await nwsFetch<{
    properties: { periods: ForecastPeriod[] }
  }>(forecastUrl.replace(NWS_BASE, ''))

  return {
    location: { lat: args.lat, lon: args.lon },
    periods: forecast.properties.periods.map((p) => ({
      name: p.name,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      wind: `${p.windSpeed} ${p.windDirection}`,
      forecast: p.shortForecast,
      detail: p.detailedForecast,
    })),
  }
}, { method: 'get_forecast' })

const getAlerts = sg.wrap(async (args: AlertsInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (2-letter code, e.g. "CA")')
  }
  const state = args.state.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new Error('state must be a 2-letter US state code (e.g. "CA", "TX")')
  }

  const data = await nwsFetch<{
    features: Array<{
      properties: {
        event: string
        headline: string
        severity: string
        urgency: string
        areaDesc: string
        effective: string
        expires: string
        description: string
      }
    }>
  }>(`/alerts/active?area=${state}`)

  return {
    state,
    count: data.features.length,
    alerts: data.features.slice(0, 20).map((f) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      area: f.properties.areaDesc,
      effective: f.properties.effective,
      expires: f.properties.expires,
      description: f.properties.description?.slice(0, 500),
    })),
  }
}, { method: 'get_alerts' })

const getStations = sg.wrap(async (args: StationsInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }

  const point = await nwsFetch<{
    properties: { observationStations: string }
  }>(`/points/${args.lat.toFixed(4)},${args.lon.toFixed(4)}`)

  const stationsUrl = point.properties.observationStations
  const stations = await nwsFetch<{
    features: Array<{
      properties: {
        stationIdentifier: string
        name: string
        elevation: { value: number; unitCode: string }
      }
      geometry: { coordinates: [number, number] }
    }>
  }>(stationsUrl.replace(NWS_BASE, ''))

  return {
    location: { lat: args.lat, lon: args.lon },
    stations: stations.features.slice(0, 10).map((f) => ({
      id: f.properties.stationIdentifier,
      name: f.properties.name,
      elevation: f.properties.elevation,
      coordinates: {
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      },
    })),
  }
}, { method: 'get_stations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getAlerts, getStations }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// import { createServer } from 'http'
//
// const middleware = settlegridMiddleware({
//   toolSlug: 'weather-gov',
//   pricing: { defaultCostCents: 1 },
//   routes: {
//     'GET /forecast': async (req) => getForecast(parseQuery(req)),
//     'GET /alerts': async (req) => getAlerts(parseQuery(req)),
//     'GET /stations': async (req) => getStations(parseQuery(req)),
//   },
// })

console.log('settlegrid-weather-gov MCP server ready')
console.log('Methods: get_forecast, get_alerts, get_stations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
