import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "precious-metals", pricing: { defaultCostCents: 2, methods: {
  get_price: { costCents: 2, displayName: "Get Metal Price" },
  get_all_prices: { costCents: 2, displayName: "Get All Prices" },
}}})
const metals: Record<string, { price_usd_oz: number; change_24h_pct: number; ytd_change_pct: number; supply_tonnes: number; top_producer: string }> = {
  gold: { price_usd_oz: 2178.40, change_24h_pct: 0.45, ytd_change_pct: 5.2, supply_tonnes: 3644, top_producer: "China" },
  silver: { price_usd_oz: 24.82, change_24h_pct: 0.72, ytd_change_pct: 1.8, supply_tonnes: 26000, top_producer: "Mexico" },
  platinum: { price_usd_oz: 904.50, change_24h_pct: -0.31, ytd_change_pct: -5.1, supply_tonnes: 180, top_producer: "South Africa" },
  palladium: { price_usd_oz: 1012.80, change_24h_pct: 0.18, ytd_change_pct: -8.3, supply_tonnes: 210, top_producer: "Russia" },
  rhodium: { price_usd_oz: 4850.00, change_24h_pct: -0.55, ytd_change_pct: -12.1, supply_tonnes: 30, top_producer: "South Africa" },
  iridium: { price_usd_oz: 4900.00, change_24h_pct: 0.0, ytd_change_pct: -2.3, supply_tonnes: 7, top_producer: "South Africa" },
}
const getPrice = sg.wrap(async (args: { metal: string }) => {
  if (!args.metal) throw new Error("metal is required")
  const m = metals[args.metal.toLowerCase()]
  if (!m) throw new Error(`Unknown metal. Available: ${Object.keys(metals).join(", ")}`)
  return { metal: args.metal, ...m }
}, { method: "get_price" })
const getAllPrices = sg.wrap(async (_args: Record<string, never>) => {
  return { count: Object.keys(metals).length, metals: Object.entries(metals).map(([k, v]) => ({ metal: k, ...v })) }
}, { method: "get_all_prices" })
export { getPrice, getAllPrices }
console.log("settlegrid-precious-metals MCP server ready | 2c/call | Powered by SettleGrid")
