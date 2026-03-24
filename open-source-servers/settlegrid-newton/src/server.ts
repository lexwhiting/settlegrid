/**
 * settlegrid-newton — Newton Math API MCP Server
 *
 * Wraps the Newton API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   derive(expression)                    (1¢)
 *   integrate(expression)                 (1¢)
 *   factor(expression)                    (1¢)
 *   simplify(expression)                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface ExprInput { expression: string }

const API_BASE = "https://newton.vercel.app/api/v2"
const USER_AGENT = "settlegrid-newton/1.0 (contact@settlegrid.ai)"

async function newtonFetch(operation: string, expression: string): Promise<Record<string, unknown>> {
  const encoded = encodeURIComponent(expression)
  const res = await fetch(`${API_BASE}/${operation}/${encoded}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Newton API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

const sg = settlegrid.init({
  toolSlug: "newton",
  pricing: {
    defaultCostCents: 1,
    methods: {
      derive: { costCents: 1, displayName: "Calculate derivative" },
      integrate: { costCents: 1, displayName: "Calculate integral" },
      factor: { costCents: 1, displayName: "Factor expression" },
      simplify: { costCents: 1, displayName: "Simplify expression" },
    },
  },
})

const derive = sg.wrap(async (args: ExprInput) => {
  if (!args.expression || typeof args.expression !== "string") throw new Error("expression is required")
  return newtonFetch("derive", args.expression)
}, { method: "derive" })

const integrate = sg.wrap(async (args: ExprInput) => {
  if (!args.expression || typeof args.expression !== "string") throw new Error("expression is required")
  return newtonFetch("integrate", args.expression)
}, { method: "integrate" })

const factor = sg.wrap(async (args: ExprInput) => {
  if (!args.expression || typeof args.expression !== "string") throw new Error("expression is required")
  return newtonFetch("factor", args.expression)
}, { method: "factor" })

const simplify = sg.wrap(async (args: ExprInput) => {
  if (!args.expression || typeof args.expression !== "string") throw new Error("expression is required")
  return newtonFetch("simplify", args.expression)
}, { method: "simplify" })

export { derive, integrate, factor, simplify }

console.log("settlegrid-newton MCP server ready")
console.log("Methods: derive, integrate, factor, simplify")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
