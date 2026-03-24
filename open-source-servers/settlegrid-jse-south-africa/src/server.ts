import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "jse-south-africa", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get JSE Index" },
  get_top_stocks: { costCents: 2, displayName: "Get Top Stocks" },
}}})
const indices: Record<string, { value: number; change_pct: number }> = {
  alsi: { value: 74823.45, change_pct: 0.21 }, top40: { value: 68234.12, change_pct: 0.18 },
  indi25: { value: 87123.67, change_pct: 0.34 }, resi20: { value: 56432.89, change_pct: -0.12 },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(indices).join(", ")}`)
  return { exchange: "JSE (Johannesburg Stock Exchange)", index: args.index, ...d }
}, { method: "get_index" })
const topStocks = [
  { symbol: "NPN", name: "Naspers", market_cap_billion_zar: 870, sector: "Technology" },
  { symbol: "PRX", name: "Prosus", market_cap_billion_zar: 1580, sector: "Technology" },
  { symbol: "AGL", name: "Anglo American", market_cap_billion_zar: 520, sector: "Mining" },
  { symbol: "BHP", name: "BHP Group", market_cap_billion_zar: 490, sector: "Mining" },
  { symbol: "FSR", name: "FirstRand", market_cap_billion_zar: 420, sector: "Banking" },
]
const getTopStocks = sg.wrap(async (args: { sector?: string }) => {
  let results = [...topStocks]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: "JSE South Africa", count: results.length, stocks: results }
}, { method: "get_top_stocks" })
export { getIndex, getTopStocks }
console.log("settlegrid-jse-south-africa MCP server ready | 2c/call | Powered by SettleGrid")
