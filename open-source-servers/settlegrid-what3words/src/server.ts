/**
 * settlegrid-what3words — what3words Address MCP Server
 *
 * Wraps the what3words API with SettleGrid billing.
 * Requires a what3words API key.
 *
 * Methods:
 *   convert_to_coordinates(words)   — Words to lat/lng    (2¢)
 *   convert_to_words(lat, lon)      — Lat/lng to words    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordsInput {
  words: string
}

interface CoordsInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const W3W_BASE = 'https://api.what3words.com/v3'
const API_KEY = process.env.W3W_API_KEY || ''

async function w3wFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('W3W_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${W3W_BASE}${path}${sep}key=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`what3words API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'what3words',
  pricing: {
    defaultCostCents: 2,
    methods: {
      convert_to_coordinates: { costCents: 2, displayName: 'Words to Coordinates' },
      convert_to_words: { costCents: 2, displayName: 'Coordinates to Words' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convertToCoordinates = sg.wrap(async (args: WordsInput) => {
  if (!args.words || typeof args.words !== 'string') {
    throw new Error('words is required (e.g. "filled.count.soap")')
  }
  const words = args.words.trim()
  if (!/^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+$/.test(words)) {
    throw new Error('words must be a valid 3-word address (e.g. "filled.count.soap")')
  }
  const data = await w3wFetch<any>(`/convert-to-coordinates?words=${encodeURIComponent(words)}`)
  return {
    words: data.words,
    lat: data.coordinates?.lat,
    lng: data.coordinates?.lng,
    country: data.country,
    nearestPlace: data.nearestPlace,
    language: data.language,
  }
}, { method: 'convert_to_coordinates' })

const convertToWords = sg.wrap(async (args: CoordsInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await w3wFetch<any>(`/convert-to-3wa?coordinates=${args.lat},${args.lon}`)
  return {
    words: data.words,
    lat: data.coordinates?.lat,
    lng: data.coordinates?.lng,
    country: data.country,
    nearestPlace: data.nearestPlace,
    language: data.language,
  }
}, { method: 'convert_to_words' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convertToCoordinates, convertToWords }

console.log('settlegrid-what3words MCP server ready')
console.log('Methods: convert_to_coordinates, convert_to_words')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
