/**
 * settlegrid-plant-id — Plant Identification MCP Server
 *
 * Wraps the Plant.id API with SettleGrid billing.
 * Requires PLANTID_API_KEY environment variable.
 *
 * Methods:
 *   identify(image_url)                   (3¢)
 *   get_health(image_url)                 (3¢)
 *   search_plant(query)                   (1¢)
 *   get_plant(access_token)               (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface IdentifyInput { image_url: string; latitude?: number; longitude?: number }
interface HealthInput { image_url: string }
interface SearchInput { query: string }
interface GetPlantInput { access_token: string }

const API_BASE = "https://plant.id/api/v3"
const USER_AGENT = "settlegrid-plant-id/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.PLANTID_API_KEY
  if (!key) throw new Error("PLANTID_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string; body?: unknown
} = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "User-Agent": USER_AGENT, Accept: "application/json",
      "Api-Key": getApiKey(), "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Plant.id API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "plant-id",
  pricing: {
    defaultCostCents: 1,
    methods: {
      identify: { costCents: 3, displayName: "Identify plant from image" },
      get_health: { costCents: 3, displayName: "Assess plant health" },
      search_plant: { costCents: 1, displayName: "Search plant database" },
      get_plant: { costCents: 1, displayName: "Get identification result" },
    },
  },
})

const identify = sg.wrap(async (args: IdentifyInput) => {
  if (!args.image_url || typeof args.image_url !== "string") throw new Error("image_url is required")
  const body: Record<string, unknown> = { images: [args.image_url], similar_images: true }
  if (args.latitude !== undefined && args.longitude !== undefined) {
    body.latitude = args.latitude; body.longitude = args.longitude
  }
  return apiFetch<Record<string, unknown>>("/identification", { method: "POST", body })
}, { method: "identify" })

const getHealth = sg.wrap(async (args: HealthInput) => {
  if (!args.image_url || typeof args.image_url !== "string") throw new Error("image_url is required")
  return apiFetch<Record<string, unknown>>("/health_assessment", {
    method: "POST", body: { images: [args.image_url], similar_images: true },
  })
}, { method: "get_health" })

const searchPlant = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>(`/kb/plants/name_search?q=${encodeURIComponent(args.query)}`)
}, { method: "search_plant" })

const getPlant = sg.wrap(async (args: GetPlantInput) => {
  if (!args.access_token || typeof args.access_token !== "string") throw new Error("access_token is required")
  return apiFetch<Record<string, unknown>>(`/identification/${encodeURIComponent(args.access_token)}`)
}, { method: "get_plant" })

export { identify, getHealth, searchPlant, getPlant }

console.log("settlegrid-plant-id MCP server ready")
console.log("Methods: identify, get_health, search_plant, get_plant")
console.log("Pricing: 1-3¢ per call | Powered by SettleGrid")
