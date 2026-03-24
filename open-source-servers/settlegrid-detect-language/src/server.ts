/**
 * settlegrid-detect-language — Language Detection MCP Server
 *
 * Wraps the Detect Language API with SettleGrid billing.
 * Requires DETECTLANGUAGE_API_KEY environment variable.
 *
 * Methods:
 *   detect(text)                          (1¢)
 *   detect_batch(texts)                   (2¢)
 *   get_languages()                       (1¢)
 *   get_status()                          (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DetectInput { text: string }
interface DetectBatchInput { texts: string[] }

const API_BASE = "https://ws.detectlanguage.com/0.2"
const USER_AGENT = "settlegrid-detect-language/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.DETECTLANGUAGE_API_KEY
  if (!key) throw new Error("DETECTLANGUAGE_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string; body?: unknown
} = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "User-Agent": USER_AGENT, Accept: "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Detect Language API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "detect-language",
  pricing: {
    defaultCostCents: 1,
    methods: {
      detect: { costCents: 1, displayName: "Detect language of text" },
      detect_batch: { costCents: 2, displayName: "Detect languages for batch" },
      get_languages: { costCents: 1, displayName: "List supported languages" },
      get_status: { costCents: 1, displayName: "Get API account status" },
    },
  },
})

const detect = sg.wrap(async (args: DetectInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/detect", { method: "POST", body: { q: args.text } })
}, { method: "detect" })

const detectBatch = sg.wrap(async (args: DetectBatchInput) => {
  if (!Array.isArray(args.texts) || args.texts.length === 0) throw new Error("texts array is required")
  if (args.texts.length > 50) throw new Error("Maximum 50 texts per batch")
  return apiFetch<Record<string, unknown>>("/detect", { method: "POST", body: { q: args.texts } })
}, { method: "detect_batch" })

const getLanguages = sg.wrap(async () => {
  return apiFetch<Array<Record<string, unknown>>>("/languages")
}, { method: "get_languages" })

const getStatus = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/user/status")
}, { method: "get_status" })

export { detect, detectBatch, getLanguages, getStatus }

console.log("settlegrid-detect-language MCP server ready")
console.log("Methods: detect, detect_batch, get_languages, get_status")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
