/**
 * settlegrid-wave-data — Ocean Wave Data MCP Server
 * Wraps NOAA NDBC with SettleGrid billing.
 * Methods:
 *   get_observations(station) — Get buoy observations (1¢)
 *   list_stations()           — List stations (1¢)
 *   get_latest(station)       — Get latest reading (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StationInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NDBC_BASE = 'https://www.ndbc.noaa.gov'

async function fetchNdbc(path: string): Promise<string> {
  const res = await fetch(`${NDBC_BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wave-data/1.0' },
  })
  if (!res.ok) {
    throw new Error(`NDBC ${res.status}: failed to fetch ${path}`)
  }
  return res.text()
}

function parseNdbcText(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n')
  if (lines.length < 3) return []
  const headers = lines[0].replace(/#/g, '').trim().split(/\s+/)
  return lines.slice(2, 12).map(line => {
    const vals = line.trim().split(/\s+/)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })
    return row
  })
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wave-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_observations: { costCents: 1, displayName: 'Get buoy observations' },
      list_stations: { costCents: 1, displayName: 'List active stations' },
      get_latest: { costCents: 1, displayName: 'Get latest observation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getObservations = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (NDBC station ID)')
  }
  const text = await fetchNdbc(`/data/realtime2/${args.station}.txt`)
  return parseNdbcText(text)
}, { method: 'get_observations' })

const listStations = sg.wrap(async () => {
  const text = await fetchNdbc('/data/realtime2/')
  const matches = text.match(/\w+\.txt/g) || []
  const stations = [...new Set(matches.map(m => m.replace('.txt', '')))]
  return { stations: stations.slice(0, 50), count: stations.length }
}, { method: 'list_stations' })

const getLatest = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const text = await fetchNdbc(`/data/realtime2/${args.station}.txt`)
  const rows = parseNdbcText(text)
  return rows.length > 0 ? rows[0] : { error: 'No data available' }
}, { method: 'get_latest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getObservations, listStations, getLatest }

console.log('settlegrid-wave-data MCP server ready')
console.log('Methods: get_observations, list_stations, get_latest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
