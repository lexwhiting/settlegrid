import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "trade-balance", pricing: { defaultCostCents: 2, methods: {
  get_balance: { costCents: 2, displayName: "Get Trade Balance" },
  get_top_partners: { costCents: 2, displayName: "Get Top Partners" },
}}})
const balances: Record<string, { exports_billion: number; imports_billion: number; balance_billion: number; currency: string; year: number }> = {
  us: { exports_billion: 2018, imports_billion: 3119, balance_billion: -1101, currency: "USD", year: 2023 },
  china: { exports_billion: 3380, imports_billion: 2556, balance_billion: 824, currency: "USD", year: 2023 },
  germany: { exports_billion: 1562, imports_billion: 1395, balance_billion: 167, currency: "EUR", year: 2023 },
  japan: { exports_billion: 756, imports_billion: 897, balance_billion: -141, currency: "USD", year: 2023 },
  india: { exports_billion: 432, imports_billion: 677, balance_billion: -245, currency: "USD", year: 2023 },
  uk: { exports_billion: 487, imports_billion: 678, balance_billion: -191, currency: "GBP", year: 2023 },
  brazil: { exports_billion: 340, imports_billion: 240, balance_billion: 100, currency: "USD", year: 2023 },
}
const getBalance = sg.wrap(async (args: { country: string }) => {
  if (!args.country) throw new Error("country is required")
  const b = balances[args.country.toLowerCase()]
  if (!b) throw new Error(`Unknown. Available: ${Object.keys(balances).join(", ")}`)
  return { country: args.country, ...b }
}, { method: "get_balance" })
const getTopPartners = sg.wrap(async (args: { country: string }) => {
  if (!args.country) throw new Error("country is required")
  const partners: Record<string, string[]> = {
    us: ["Canada", "Mexico", "China", "Japan", "Germany"],
    china: ["United States", "Japan", "South Korea", "Vietnam", "Germany"],
    germany: ["United States", "China", "France", "Netherlands", "Poland"],
    japan: ["China", "United States", "South Korea", "Taiwan", "Thailand"],
  }
  const p = partners[args.country.toLowerCase()]
  if (!p) throw new Error(`Partners not available for ${args.country}`)
  return { country: args.country, top_trading_partners: p }
}, { method: "get_top_partners" })
export { getBalance, getTopPartners }
console.log("settlegrid-trade-balance MCP server ready | 2c/call | Powered by SettleGrid")
