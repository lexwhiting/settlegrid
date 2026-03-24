import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "sse-shanghai", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get SSE Index" },
  get_market_stats: { costCents: 2, displayName: "Get Market Stats" },
}}})
const indices: Record<string, { value: number; change_pct: number }> = {
  composite: { value: 3048.97, change_pct: -0.22 }, sse50: { value: 2442.15, change_pct: -0.18 },
  sse180: { value: 8127.34, change_pct: -0.15 }, star50: { value: 867.23, change_pct: 0.34 },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(indices).join(", ")}`)
  return { exchange: "Shanghai Stock Exchange", index: args.index, ...d }
}, { method: "get_index" })
const getMarketStats = sg.wrap(async (_args: Record<string, never>) => {
  return { exchange: "SSE", listed_companies: 2266, total_market_cap_trillion_cny: 47.2, daily_turnover_billion_cny: 385, star_market_companies: 570, ipo_ytd: 45, top_sectors: ["Financials", "Industrials", "Consumer", "Technology", "Healthcare"] }
}, { method: "get_market_stats" })
export { getIndex, getMarketStats }
console.log("settlegrid-sse-shanghai MCP server ready | 2c/call | Powered by SettleGrid")
