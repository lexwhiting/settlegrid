/**
 * settlegrid-bird-songs — Bird Songs MCP Server
 *
 * Wraps the Xeno-canto API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   search_bird(query)                    (1¢)
 *   get_recording(id)                     (1¢)
 *   random_bird()                         (1¢)
 *   search_by_country(country)            (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; page?: number }
interface GetRecordingInput { id: string }
interface CountryInput { country: string; page?: number }

const API_BASE = "https://xeno-canto.org/api/2/recordings"
const USER_AGENT = "settlegrid-bird-songs/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Xeno-canto API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "bird-songs",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_bird: { costCents: 1, displayName: "Search bird recordings" },
      get_recording: { costCents: 1, displayName: "Get recording details" },
      random_bird: { costCents: 1, displayName: "Get random bird recording" },
      search_by_country: { costCents: 1, displayName: "Bird sounds by country" },
    },
  },
})

const searchBird = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required (bird name)")
  const params: Record<string, string> = { query: args.query }
  if (args.page !== undefined) params.page = String(args.page)
  const data = await apiFetch<{ numRecordings: string; numSpecies: string; recordings: Array<Record<string, unknown>> }>(params)
  return {
    query: args.query, total_recordings: data.numRecordings, total_species: data.numSpecies,
    recordings: data.recordings.slice(0, 20).map((r) => ({
      id: r.id, species: r.en, scientific_name: r.sp, country: r.cnt,
      location: r.loc, type: r.type, url: r.file, quality: r.q,
    })),
  }
}, { method: "search_bird" })

const getRecording = sg.wrap(async (args: GetRecordingInput) => {
  if (!args.id || typeof args.id !== "string") throw new Error("id is required")
  const data = await apiFetch<{ recordings: Array<Record<string, unknown>> }>({ query: `nr:${args.id}` })
  if (!data.recordings || data.recordings.length === 0) throw new Error(`Recording ${args.id} not found`)
  const r = data.recordings[0]
  return {
    id: r.id, species: r.en, scientific_name: r.sp, country: r.cnt,
    location: r.loc, type: r.type, url: r.file, quality: r.q,
    recordist: r.rec, date: r.date, time: r.time, length: r.length,
  }
}, { method: "get_recording" })

const randomBird = sg.wrap(async () => {
  const birds = ["robin","eagle","owl","sparrow","crow","finch","hawk","wren","jay","cardinal"]
  const bird = birds[Math.floor(Math.random() * birds.length)]
  const data = await apiFetch<{ recordings: Array<Record<string, unknown>> }>({ query: bird })
  if (!data.recordings || data.recordings.length === 0) return { message: "No recordings found" }
  const r = data.recordings[Math.floor(Math.random() * Math.min(data.recordings.length, 10))]
  return {
    id: r.id, species: r.en, scientific_name: r.sp, country: r.cnt,
    url: r.file, type: r.type, quality: r.q,
  }
}, { method: "random_bird" })

const searchByCountry = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== "string") throw new Error("country is required")
  const params: Record<string, string> = { query: `cnt:"${args.country}"` }
  if (args.page !== undefined) params.page = String(args.page)
  const data = await apiFetch<{ numRecordings: string; numSpecies: string; recordings: Array<Record<string, unknown>> }>(params)
  return {
    country: args.country, total_recordings: data.numRecordings, total_species: data.numSpecies,
    recordings: data.recordings.slice(0, 20).map((r) => ({
      id: r.id, species: r.en, scientific_name: r.sp, url: r.file, quality: r.q,
    })),
  }
}, { method: "search_by_country" })

export { searchBird, getRecording, randomBird, searchByCountry }

console.log("settlegrid-bird-songs MCP server ready")
console.log("Methods: search_bird, get_recording, random_bird, search_by_country")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
