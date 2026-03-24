/**
 * settlegrid-sunrise-sunset — Sunrise/Sunset Times MCP Server
 *
 * Wraps the Sunrise-Sunset API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_sun_times(lat, lon, date)  — Sun times for location  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SunTimesInput {
  lat: number
  lon: number
  date?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SUN_BASE = 'https://api.sunrise-sunset.org/json'

async function sunFetch<T>(params: string): Promise<T> {
  const res = await fetch(`${SUN_BASE}?${params}&formatted=0`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sunrise-Sunset API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as any
  if (data.status !== 'OK') throw new Error(`Sunrise-Sunset: ${data.status}`)
  return data as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sunrise-sunset',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_sun_times: { costCents: 1, displayName: 'Sun Times' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSunTimes = sg.wrap(async (args: SunTimesInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  let params = `lat=${args.lat}&lng=${args.lon}`
  if (args.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error('date must be YYYY-MM-DD format')
    }
    params += `&date=${args.date}`
  }
  const data = await sunFetch<{ results: any }>(params)
  const r = data.results
  return {
    lat: args.lat,
    lon: args.lon,
    date: args.date || 'today',
    sunrise: r.sunrise,
    sunset: r.sunset,
    solarNoon: r.solar_noon,
    dayLength: r.day_length,
    civilTwilightBegin: r.civil_twilight_begin,
    civilTwilightEnd: r.civil_twilight_end,
    nauticalTwilightBegin: r.nautical_twilight_begin,
    nauticalTwilightEnd: r.nautical_twilight_end,
    astronomicalTwilightBegin: r.astronomical_twilight_begin,
    astronomicalTwilightEnd: r.astronomical_twilight_end,
  }
}, { method: 'get_sun_times' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSunTimes }

console.log('settlegrid-sunrise-sunset MCP server ready')
console.log('Methods: get_sun_times')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
