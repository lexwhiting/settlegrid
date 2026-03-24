import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "b3-brazil", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get B3 Index" },
  get_top_stocks: { costCents: 2, displayName: "Get Top Stocks" },
}}})
const indices: Record<string, { value: number; change_pct: number }> = {
  ibovespa: { value: 128106.10, change_pct: 0.56 }, ibrx50: { value: 20134.45, change_pct: 0.48 },
  smll: { value: 2198.76, change_pct: 0.72 }, idiv: { value: 7234.12, change_pct: 0.31 },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(indices).join(", ")}`)
  return { exchange: "B3 (Brasil Bolsa Balcao)", index: args.index, ...d }
}, { method: "get_index" })
const topStocks = [
  { symbol: "PETR4", name: "Petrobras", market_cap_billion_brl: 530, sector: "Oil & Gas" },
  { symbol: "VALE3", name: "Vale", market_cap_billion_brl: 280, sector: "Mining" },
  { symbol: "ITUB4", name: "Itau Unibanco", market_cap_billion_brl: 310, sector: "Banking" },
  { symbol: "BBDC4", name: "Bradesco", market_cap_billion_brl: 160, sector: "Banking" },
  { symbol: "WEGE3", name: "WEG", market_cap_billion_brl: 190, sector: "Industrials" },
]
const getTopStocks = sg.wrap(async (args: { sector?: string }) => {
  let results = [...topStocks]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: "B3 Brazil", count: results.length, stocks: results }
}, { method: "get_top_stocks" })
export { getIndex, getTopStocks }
console.log("settlegrid-b3-brazil MCP server ready | 2c/call | Powered by SettleGrid")
