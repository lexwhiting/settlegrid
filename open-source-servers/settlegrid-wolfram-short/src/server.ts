/**
 * settlegrid-wolfram-short — Wolfram Alpha Short Answers MCP Server
 *
 * Wraps the Wolfram Alpha Short Answers API with SettleGrid billing.
 * Requires WOLFRAM_APP_ID environment variable.
 *
 * Methods:
 *   short_answer(query)                   (2¢)
 *   spoken_answer(query)                  (2¢)
 *   simple_query(query)                   (1¢)
 *   validate_query(query)                 (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface QueryInput { query: string; units?: string }

const USER_AGENT = "settlegrid-wolfram-short/1.0 (contact@settlegrid.ai)"

function getAppId(): string {
  const key = process.env.WOLFRAM_APP_ID
  if (!key) throw new Error("WOLFRAM_APP_ID environment variable is required")
  return key
}

async function wolframFetch(endpoint: string, query: string, params: Record<string, string> = {}): Promise<string> {
  const url = new URL(`https://api.wolframalpha.com/${endpoint}`)
  url.searchParams.set("appid", getAppId())
  url.searchParams.set("i", query)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Wolfram Alpha API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

const sg = settlegrid.init({
  toolSlug: "wolfram-short",
  pricing: {
    defaultCostCents: 1,
    methods: {
      short_answer: { costCents: 2, displayName: "Get short answer to question" },
      spoken_answer: { costCents: 2, displayName: "Get spoken-form answer" },
      simple_query: { costCents: 1, displayName: "Get simple text result" },
      validate_query: { costCents: 1, displayName: "Check if query is answerable" },
    },
  },
})

const shortAnswer = sg.wrap(async (args: QueryInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = {}
  if (args.units) params.units = args.units
  const answer = await wolframFetch("v1/result", args.query, params)
  return { query: args.query, answer }
}, { method: "short_answer" })

const spokenAnswer = sg.wrap(async (args: QueryInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = {}
  if (args.units) params.units = args.units
  const answer = await wolframFetch("v1/spoken", args.query, params)
  return { query: args.query, spoken: answer }
}, { method: "spoken_answer" })

const simpleQuery = sg.wrap(async (args: QueryInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const answer = await wolframFetch("v1/result", args.query)
  return { query: args.query, result: answer }
}, { method: "simple_query" })

const validateQuery = sg.wrap(async (args: QueryInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const url = new URL("https://api.wolframalpha.com/v2/query")
  url.searchParams.set("appid", getAppId())
  url.searchParams.set("input", args.query)
  url.searchParams.set("output", "json")
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Wolfram Alpha API ${res.status}`)
  const data = await res.json() as { queryresult?: { success?: boolean; inputstring?: string } }
  return { query: args.query, is_valid: data.queryresult?.success ?? false, parsed_as: data.queryresult?.inputstring ?? args.query }
}, { method: "validate_query" })

export { shortAnswer, spokenAnswer, simpleQuery, validateQuery }

console.log("settlegrid-wolfram-short MCP server ready")
console.log("Methods: short_answer, spoken_answer, simple_query, validate_query")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
