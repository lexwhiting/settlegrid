/**
 * settlegrid-textgears — TextGears MCP Server
 *
 * Wraps the TextGears API with SettleGrid billing.
 * Requires TEXTGEARS_API_KEY environment variable.
 *
 * Methods:
 *   check_grammar(text)                   (2¢)
 *   check_spelling(text)                  (1¢)
 *   analyze_readability(text)             (1¢)
 *   detect_language(text)                 (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface TextInput { text: string; language?: string }

const API_BASE = "https://api.textgears.com"
const USER_AGENT = "settlegrid-textgears/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.TEXTGEARS_API_KEY
  if (!key) throw new Error("TEXTGEARS_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("key", getApiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`TextGears API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "textgears",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_grammar: { costCents: 2, displayName: "Check grammar errors" },
      check_spelling: { costCents: 1, displayName: "Check spelling errors" },
      analyze_readability: { costCents: 1, displayName: "Get readability score" },
      detect_language: { costCents: 1, displayName: "Detect text language" },
    },
  },
})

const checkGrammar = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/grammar", { text: args.text, language: args.language ?? "en-US" })
}, { method: "check_grammar" })

const checkSpelling = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/spelling", { text: args.text, language: args.language ?? "en-US" })
}, { method: "check_spelling" })

const analyzeReadability = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/readability", { text: args.text, language: args.language ?? "en-US" })
}, { method: "analyze_readability" })

const detectLanguage = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiFetch<Record<string, unknown>>("/detect", { text: args.text })
}, { method: "detect_language" })

export { checkGrammar, checkSpelling, analyzeReadability, detectLanguage }

console.log("settlegrid-textgears MCP server ready")
console.log("Methods: check_grammar, check_spelling, analyze_readability, detect_language")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
