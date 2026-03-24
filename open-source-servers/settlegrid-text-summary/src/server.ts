/**
 * settlegrid-text-summary — Text Summarization MCP Server
 *
 * Wraps the MeaningCloud API with SettleGrid billing.
 * Requires MEANINGCLOUD_API_KEY environment variable.
 *
 * Methods:
 *   summarize(text, sentences)            (2¢)
 *   extract_topics(text)                  (2¢)
 *   classify_text(text)                   (1¢)
 *   extract_entities(text)                (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SummarizeInput { text: string; sentences?: number }
interface TextInput { text: string }

const API_BASE = "https://api.meaningcloud.com"
const USER_AGENT = "settlegrid-text-summary/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.MEANINGCLOUD_API_KEY
  if (!key) throw new Error("MEANINGCLOUD_API_KEY environment variable is required")
  return key
}

async function apiPost<T>(path: string, body: Record<string, string>): Promise<T> {
  body.key = getApiKey()
  const form = new URLSearchParams(body)
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`MeaningCloud API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "text-summary",
  pricing: {
    defaultCostCents: 2,
    methods: {
      summarize: { costCents: 2, displayName: "Summarize text" },
      extract_topics: { costCents: 2, displayName: "Extract key topics" },
      classify_text: { costCents: 1, displayName: "Classify text category" },
      extract_entities: { costCents: 2, displayName: "Extract named entities" },
    },
  },
})

const summarize = sg.wrap(async (args: SummarizeInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiPost<Record<string, unknown>>("/summarization-1.0", {
    txt: args.text, sentences: String(args.sentences ?? 3), lang: "auto",
  })
}, { method: "summarize" })

const extractTopics = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiPost<Record<string, unknown>>("/topics-2.0", { txt: args.text, lang: "auto", tt: "a" })
}, { method: "extract_topics" })

const classifyText = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiPost<Record<string, unknown>>("/class-2.0", { txt: args.text, model: "IPTC_en" })
}, { method: "classify_text" })

const extractEntities = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiPost<Record<string, unknown>>("/topics-2.0", { txt: args.text, lang: "auto", tt: "e" })
}, { method: "extract_entities" })

export { summarize, extractTopics, classifyText, extractEntities }

console.log("settlegrid-text-summary MCP server ready")
console.log("Methods: summarize, extract_topics, classify_text, extract_entities")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
