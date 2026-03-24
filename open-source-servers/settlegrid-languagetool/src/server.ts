/**
 * settlegrid-languagetool — LanguageTool MCP Server
 *
 * Wraps the LanguageTool API with SettleGrid billing.
 * No external API key required (public API).
 *
 * Methods:
 *   check_text(text, language)            (2¢)
 *   get_languages()                       (1¢)
 *   check_with_rules(text, rules)         (2¢)
 *   get_words()                           (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckTextInput { text: string; language?: string }
interface CheckWithRulesInput { text: string; language?: string; enabledRules?: string }

const API_BASE = "https://api.languagetool.org/v2"
const USER_AGENT = "settlegrid-languagetool/1.0 (contact@settlegrid.ai)"

async function apiPost<T>(path: string, body: Record<string, string>): Promise<T> {
  const form = new URLSearchParams(body)
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`LanguageTool API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`LanguageTool API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "languagetool",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_text: { costCents: 2, displayName: "Check text for grammar/spelling errors" },
      get_languages: { costCents: 1, displayName: "List supported languages" },
      check_with_rules: { costCents: 2, displayName: "Check with specific rules" },
      get_words: { costCents: 1, displayName: "Get dictionary words" },
    },
  },
})

const checkText = sg.wrap(async (args: CheckTextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  if (args.text.length > 10000) throw new Error("text must be under 10,000 characters")
  return apiPost<Record<string, unknown>>("/check", {
    text: args.text, language: args.language ?? "auto", enabledOnly: "false",
  })
}, { method: "check_text" })

const getLanguages = sg.wrap(async () => {
  return apiGet<Array<Record<string, unknown>>>("/languages")
}, { method: "get_languages" })

const checkWithRules = sg.wrap(async (args: CheckWithRulesInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  if (args.text.length > 10000) throw new Error("text must be under 10,000 characters")
  const body: Record<string, string> = {
    text: args.text, language: args.language ?? "auto",
  }
  if (args.enabledRules) { body.enabledRules = args.enabledRules; body.enabledOnly = "true" }
  return apiPost<Record<string, unknown>>("/check", body)
}, { method: "check_with_rules" })

const getWords = sg.wrap(async () => {
  return { message: "Personal dictionary words are only available with a premium LanguageTool account", words: [] }
}, { method: "get_words" })

export { checkText, getLanguages, checkWithRules, getWords }

console.log("settlegrid-languagetool MCP server ready")
console.log("Methods: check_text, get_languages, check_with_rules, get_words")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
