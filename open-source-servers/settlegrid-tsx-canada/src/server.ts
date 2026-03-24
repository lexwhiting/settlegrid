import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "tsx-canada", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get TSX Index" },
  get_top_stocks: { costCents: 2, displayName: "Get Top Stocks" },
}}})
const indices: Record<string, { value: number; change_pct: number }> = {
  composite: { value: 22070.45, change_pct: 0.32 }, tsx60: { value: 1332.18, change_pct: 0.28 },
  venture: { value: 578.34, change_pct: 0.45 }, capped_energy: { value: 232.67, change_pct: -0.11 },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(indices).join(", ")}`)
  return { exchange: "Toronto Stock Exchange", index: args.index, ...d }
}, { method: "get_index" })
const topStocks = [
  { symbol: "RY", name: "Royal Bank of Canada", market_cap_billion_cad: 212, sector: "Banking" },
  { symbol: "TD", name: "Toronto-Dominion Bank", market_cap_billion_cad: 155, sector: "Banking" },
  { symbol: "SHOP", name: "Shopify", market_cap_billion_cad: 130, sector: "Technology" },
  { symbol: "ENB", name: "Enbridge", market_cap_billion_cad: 102, sector: "Energy" },
  { symbol: "CNR", name: "Canadian National Railway", market_cap_billion_cad: 98, sector: "Transport" },
]
const getTopStocks = sg.wrap(async (args: { sector?: string }) => {
  let results = [...topStocks]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: "TSX Canada", count: results.length, stocks: results }
}, { method: "get_top_stocks" })
export { getIndex, getTopStocks }
console.log("settlegrid-tsx-canada MCP server ready | 2c/call | Powered by SettleGrid")
