import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "bse-india", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get BSE Index" },
  get_top_stocks: { costCents: 2, displayName: "Get Top Stocks" },
}}})
const indices: Record<string, { value: number; change_pct: number; date: string }> = {
  sensex: { value: 73876.82, change_pct: 0.34, date: "2024-03-22" },
  bse100: { value: 22841.12, change_pct: 0.28, date: "2024-03-22" },
  bse200: { value: 9834.56, change_pct: 0.31, date: "2024-03-22" },
  bse500: { value: 33217.89, change_pct: 0.29, date: "2024-03-22" },
  midcap: { value: 38432.67, change_pct: 0.42, date: "2024-03-22" },
  smallcap: { value: 44215.34, change_pct: 0.51, date: "2024-03-22" },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown index. Available: ${Object.keys(indices).join(", ")}`)
  return { exchange: "BSE India", index: args.index, ...d }
}, { method: "get_index" })
const topStocks = [
  { symbol: "RELIANCE", name: "Reliance Industries", market_cap_billion_usd: 235, sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services", market_cap_billion_usd: 170, sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank", market_cap_billion_usd: 155, sector: "Banking" },
  { symbol: "INFY", name: "Infosys", market_cap_billion_usd: 82, sector: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank", market_cap_billion_usd: 98, sector: "Banking" },
]
const getTopStocks = sg.wrap(async (args: { sector?: string }) => {
  let results = [...topStocks]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase() === args.sector!.toLowerCase())
  return { exchange: "BSE India", count: results.length, stocks: results }
}, { method: "get_top_stocks" })
export { getIndex, getTopStocks }
console.log("settlegrid-bse-india MCP server ready | 2c/call | Powered by SettleGrid")
