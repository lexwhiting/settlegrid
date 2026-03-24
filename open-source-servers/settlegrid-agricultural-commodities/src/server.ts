import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "agricultural-commodities", pricing: { defaultCostCents: 2, methods: {
  get_commodity: { costCents: 2, displayName: "Get Commodity" },
  list_commodities: { costCents: 2, displayName: "List Commodities" },
}}})
const commodities: Record<string, { price: number; unit: string; change_pct: number; top_producer: string; global_production_mt: number }> = {
  wheat: { price: 5.82, unit: "USD/bushel", change_pct: -2.1, top_producer: "China", global_production_mt: 784 },
  corn: { price: 4.38, unit: "USD/bushel", change_pct: -1.5, top_producer: "United States", global_production_mt: 1222 },
  soybeans: { price: 11.84, unit: "USD/bushel", change_pct: 0.8, top_producer: "Brazil", global_production_mt: 370 },
  rice: { price: 17.42, unit: "USD/cwt", change_pct: 3.2, top_producer: "China", global_production_mt: 520 },
  coffee: { price: 1.89, unit: "USD/lb", change_pct: 5.4, top_producer: "Brazil", global_production_mt: 10.7 },
  cocoa: { price: 5234, unit: "USD/tonne", change_pct: 42.1, top_producer: "Ivory Coast", global_production_mt: 4.8 },
  sugar: { price: 0.215, unit: "USD/lb", change_pct: -3.8, top_producer: "Brazil", global_production_mt: 180 },
  cotton: { price: 0.87, unit: "USD/lb", change_pct: 1.2, top_producer: "China", global_production_mt: 25 },
  palm_oil: { price: 856, unit: "USD/tonne", change_pct: 2.7, top_producer: "Indonesia", global_production_mt: 77 },
}
const getCommodity = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const c = commodities[args.name.toLowerCase().replace(/ /g, "_")]
  if (!c) throw new Error(`Unknown. Available: ${Object.keys(commodities).join(", ")}`)
  return { commodity: args.name, ...c }
}, { method: "get_commodity" })
const listCommodities = sg.wrap(async (_args: Record<string, never>) => {
  return { count: Object.keys(commodities).length, commodities: Object.entries(commodities).map(([k, v]) => ({ name: k, ...v })) }
}, { method: "list_commodities" })
export { getCommodity, listCommodities }
console.log("settlegrid-agricultural-commodities MCP server ready | 2c/call | Powered by SettleGrid")
