/**
 * settlegrid-train-data — Finnish Rail MCP Server
 *
 * Train schedules and live tracking from the Finnish Transport Agency.
 *
 * Methods:
 *   get_live_trains(station)      — Get live trains arriving/departing a station  (1¢)
 *   get_train(train_number, date) — Get details of a specific train by number and date  (1¢)
 *   get_stations()                — Get all railway stations in Finland  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLiveTrainsInput {
  station: string
}

interface GetTrainInput {
  train_number: number
  date: string
}

interface GetStationsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://rata.digitraffic.fi/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-train-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Finnish Rail API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'train-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_live_trains: { costCents: 1, displayName: 'Live Trains at Station' },
      get_train: { costCents: 1, displayName: 'Train Details' },
      get_stations: { costCents: 1, displayName: 'All Stations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLiveTrains = sg.wrap(async (args: GetLiveTrainsInput) => {
  if (!args.station || typeof args.station !== 'string') throw new Error('station is required')
  const station = args.station.trim()
  const data = await apiFetch<any>(`/live-trains/station/${encodeURIComponent(station)}`)
  return {
    trainNumber: data.trainNumber,
    trainType: data.trainType,
    trainCategory: data.trainCategory,
    commuterLineID: data.commuterLineID,
    timeTableRows: data.timeTableRows,
  }
}, { method: 'get_live_trains' })

const getTrain = sg.wrap(async (args: GetTrainInput) => {
  if (typeof args.train_number !== 'number') throw new Error('train_number is required and must be a number')
  const train_number = args.train_number
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  const date = args.date.trim()
  const data = await apiFetch<any>(`/trains/${encodeURIComponent(date)}/${train_number}`)
  return {
    trainNumber: data.trainNumber,
    trainType: data.trainType,
    trainCategory: data.trainCategory,
    timetableType: data.timetableType,
    timeTableRows: data.timeTableRows,
  }
}, { method: 'get_train' })

const getStations = sg.wrap(async (args: GetStationsInput) => {

  const data = await apiFetch<any>(`/metadata/stations`)
  return {
    stationName: data.stationName,
    stationShortCode: data.stationShortCode,
    countryCode: data.countryCode,
    latitude: data.latitude,
    longitude: data.longitude,
    type: data.type,
  }
}, { method: 'get_stations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLiveTrains, getTrain, getStations }

console.log('settlegrid-train-data MCP server ready')
console.log('Methods: get_live_trains, get_train, get_stations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
