/**
 * settlegrid-libre-translate — LibreTranslate MCP Server
 *
 * Wraps the LibreTranslate API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   translate(text, source, target)       (2¢)
 *   detect_language(text)                 (1¢)
 *   get_languages()                       (1¢)
 *   translate_html(html, source, target)  (3¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface TranslateInput { text: string; source?: string; target: string }
interface DetectInput { text: string }
interface TranslateHtmlInput { html: string; source?: string; target: string }

const API_BASE = "https://libretranslate.com"
const USER_AGENT = "settlegrid-libre-translate/1.0 (contact@settlegrid.ai)"

async function apiPost<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`LibreTranslate API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "libre-translate",
  pricing: {
    defaultCostCents: 2,
    methods: {
      translate: { costCents: 2, displayName: "Translate text between languages" },
      detect_language: { costCents: 1, displayName: "Detect text language" },
      get_languages: { costCents: 1, displayName: "List supported languages" },
      translate_html: { costCents: 3, displayName: "Translate HTML content" },
    },
  },
})

const translate = sg.wrap(async (args: TranslateInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  if (!args.target || typeof args.target !== "string") throw new Error("target language is required")
  return apiPost<Record<string, unknown>>("/translate", {
    q: args.text, source: args.source ?? "auto", target: args.target, format: "text",
  })
}, { method: "translate" })

const detectLanguage = sg.wrap(async (args: DetectInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  return apiPost<Array<Record<string, unknown>>>("/detect", { q: args.text })
}, { method: "detect_language" })

const getLanguages = sg.wrap(async () => {
  const res = await fetch(`${API_BASE}/languages`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`LibreTranslate API ${res.status}`)
  return res.json() as Promise<Array<Record<string, unknown>>>
}, { method: "get_languages" })

const translateHtml = sg.wrap(async (args: TranslateHtmlInput) => {
  if (!args.html || typeof args.html !== "string") throw new Error("html is required")
  if (!args.target || typeof args.target !== "string") throw new Error("target language is required")
  return apiPost<Record<string, unknown>>("/translate", {
    q: args.html, source: args.source ?? "auto", target: args.target, format: "html",
  })
}, { method: "translate_html" })

export { translate, detectLanguage, getLanguages, translateHtml }

console.log("settlegrid-libre-translate MCP server ready")
console.log("Methods: translate, detect_language, get_languages, translate_html")
console.log("Pricing: 1-3¢ per call | Powered by SettleGrid")
