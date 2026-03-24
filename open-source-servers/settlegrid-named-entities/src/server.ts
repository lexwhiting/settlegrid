/**
 * settlegrid-named-entities — NER Extraction MCP Server
 *
 * Wraps the Dandelion API with SettleGrid billing.
 * Requires DANDELION_API_KEY environment variable.
 *
 * Methods:
 *   extract_entities(text)                (2¢)
 *   get_sentiment(text)                   (2¢)
 *   get_language(text)                    (1¢)
 *   get_keywords(text)                    (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface TextInput { text: string; lang?: string; min_confidence?: number }

const API_BASE = "https://api.dandelion.eu/datatxt"
const USER_AGENT = "settlegrid-named-entities/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.DANDELION_API_KEY
  if (!key) throw new Error("DANDELION_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("token", getApiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Dandelion API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "named-entities",
  pricing: {
    defaultCostCents: 2,
    methods: {
      extract_entities: { costCents: 2, displayName: "Extract named entities" },
      get_sentiment: { costCents: 2, displayName: "Get entity-level sentiment" },
      get_language: { costCents: 1, displayName: "Detect text language" },
      get_keywords: { costCents: 1, displayName: "Extract key concepts" },
    },
  },
})

const extractEntities = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const params: Record<string, string> = { text: args.text, include: "types,abstract,categories" }
  if (args.lang) params.lang = args.lang
  if (args.min_confidence !== undefined) params.min_confidence = String(args.min_confidence)
  return apiFetch<Record<string, unknown>>("/nex/v1", params)
}, { method: "extract_entities" })

const getSentiment = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const params: Record<string, string> = { text: args.text }
  if (args.lang) params.lang = args.lang
  return apiFetch<Record<string, unknown>>("/sent/v1", params)
}, { method: "get_sentiment" })

const getLanguage = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/li/v1", { text: args.text })
}, { method: "get_language" })

const getKeywords = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const params: Record<string, string> = { text: args.text, top_entities: "10" }
  if (args.lang) params.lang = args.lang
  return apiFetch<Record<string, unknown>>("/nex/v1", params)
}, { method: "get_keywords" })

export { extractEntities, getSentiment, getLanguage, getKeywords }

console.log("settlegrid-named-entities MCP server ready")
console.log("Methods: extract_entities, get_sentiment, get_language, get_keywords")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
