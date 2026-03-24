/**
 * settlegrid-profanity-filter — Profanity Filter MCP Server
 *
 * Wraps the PurgoMalum API with SettleGrid billing.
 * No external API key required (public API).
 *
 * Methods:
 *   check_text(text)                      (1¢)
 *   censor_text(text)                     (1¢)
 *   check_username(username)              (1¢)
 *   get_word_count(text)                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface TextInput { text: string; fill_char?: string }
interface UsernameInput { username: string }

const API_BASE = "https://www.purgomalum.com/service"
const USER_AGENT = "settlegrid-profanity-filter/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`PurgoMalum API ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("json")) return res.json() as Promise<T>
  const text = await res.text()
  return text as unknown as T
}

const sg = settlegrid.init({
  toolSlug: "profanity-filter",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_text: { costCents: 1, displayName: "Check text for profanity" },
      censor_text: { costCents: 1, displayName: "Censor profane words" },
      check_username: { costCents: 1, displayName: "Check username appropriateness" },
      get_word_count: { costCents: 1, displayName: "Count profane words" },
    },
  },
})

const checkText = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const result = await apiFetch<string>("/containsprofanity", { text: args.text })
  return { text: args.text.slice(0, 100), contains_profanity: result === "true" }
}, { method: "check_text" })

const censorText = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const params: Record<string, string> = { text: args.text }
  if (args.fill_char) params.fill_char = args.fill_char
  const censored = await apiFetch<string>("/json", params)
  return typeof censored === "string" ? { result: censored } : censored
}, { method: "censor_text" })

const checkUsername = sg.wrap(async (args: UsernameInput) => {
  if (!args.username || typeof args.username !== "string") throw new Error("username is required")
  const result = await apiFetch<string>("/containsprofanity", { text: args.username })
  return { username: args.username, is_appropriate: result !== "true", contains_profanity: result === "true" }
}, { method: "check_username" })

const getWordCount = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const clean = await apiFetch<{ result?: string }>("/json", { text: args.text, fill_char: "" })
  const original = args.text.split(/\s+/).length
  const cleanText = typeof clean === "object" && clean.result ? clean.result : String(clean)
  const cleaned = cleanText.split(/\s+/).filter(Boolean).length
  return { total_words: original, profane_words: original - cleaned, clean_words: cleaned }
}, { method: "get_word_count" })

export { checkText, censorText, checkUsername, getWordCount }

console.log("settlegrid-profanity-filter MCP server ready")
console.log("Methods: check_text, censor_text, check_username, get_word_count")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
