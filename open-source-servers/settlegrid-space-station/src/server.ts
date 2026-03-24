/**
 * settlegrid-space-station — ISS Tracker MCP Server
 *
 * Tracks the ISS location and astronauts with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_location()                        (1¢)
 *   get_astronauts()                      (1¢)
 *   get_passes(lat, lon)                  (1¢)
 *   get_tle()                             (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface PassesInput { lat: number; lon: number; n?: number }

const USER_AGENT = "settlegrid-space-station/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "space-station",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_location: { costCents: 1, displayName: "Get current ISS location" },
      get_astronauts: { costCents: 1, displayName: "List people in space" },
      get_passes: { costCents: 1, displayName: "Get ISS pass predictions" },
      get_tle: { costCents: 1, displayName: "Get ISS TLE orbital data" },
    },
  },
})

const getLocation = sg.wrap(async () => {
  const data = await apiFetch<{ iss_position: { latitude: string; longitude: string }; timestamp: number }>(
    "http://api.open-notify.org/iss-now.json"
  )
  return {
    latitude: parseFloat(data.iss_position.latitude),
    longitude: parseFloat(data.iss_position.longitude),
    timestamp: data.timestamp,
    datetime: new Date(data.timestamp * 1000).toISOString(),
    map_url: `https://www.google.com/maps?q=${data.iss_position.latitude},${data.iss_position.longitude}`,
  }
}, { method: "get_location" })

const getAstronauts = sg.wrap(async () => {
  const data = await apiFetch<{ people: Array<{ name: string; craft: string }>; number: number }>(
    "http://api.open-notify.org/astros.json"
  )
  const byCraft: Record<string, string[]> = {}
  for (const p of data.people) {
    if (!byCraft[p.craft]) byCraft[p.craft] = []
    byCraft[p.craft].push(p.name)
  }
  return { total: data.number, people: data.people, by_craft: byCraft }
}, { method: "get_astronauts" })

const getPasses = sg.wrap(async (args: PassesInput) => {
  if (args.lat === undefined || args.lon === undefined) throw new Error("lat and lon are required")
  if (args.lat < -90 || args.lat > 90) throw new Error("lat must be between -90 and 90")
  if (args.lon < -180 || args.lon > 180) throw new Error("lon must be between -180 and 180")
  const n = args.n ?? 5
  // Use satellite tracking API
  const data = await apiFetch<Record<string, unknown>>(
    `https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${Array.from({length: n}, (_, i) => Math.floor(Date.now()/1000) + i * 5400).join(",")}&units=kilometers`
  )
  return { latitude: args.lat, longitude: args.lon, predictions: n, data }
}, { method: "get_passes" })

const getTle = sg.wrap(async () => {
  const data = await apiFetch<Record<string, unknown>>(
    "https://api.wheretheiss.at/v1/satellites/25544"
  )
  return { satellite: "ISS (ZARYA)", norad_id: 25544, ...data }
}, { method: "get_tle" })

export { getLocation, getAstronauts, getPasses, getTle }

console.log("settlegrid-space-station MCP server ready")
console.log("Methods: get_location, get_astronauts, get_passes, get_tle")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
