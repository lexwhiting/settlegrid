import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "microfinance", pricing: { defaultCostCents: 2, methods: {
  get_country_stats: { costCents: 2, displayName: "Get Country Stats" },
  get_global_overview: { costCents: 2, displayName: "Get Global Overview" },
}}})
const countries: Record<string, { borrowers_million: number; avg_loan_usd: number; portfolio_billion_usd: number; repayment_rate_pct: number; mfi_count: number }> = {
  india: { borrowers_million: 59.3, avg_loan_usd: 148, portfolio_billion_usd: 33.4, repayment_rate_pct: 96.2, mfi_count: 234 },
  bangladesh: { borrowers_million: 33.7, avg_loan_usd: 186, portfolio_billion_usd: 12.8, repayment_rate_pct: 97.1, mfi_count: 156 },
  vietnam: { borrowers_million: 7.4, avg_loan_usd: 632, portfolio_billion_usd: 4.7, repayment_rate_pct: 98.5, mfi_count: 48 },
  peru: { borrowers_million: 5.2, avg_loan_usd: 2450, portfolio_billion_usd: 12.7, repayment_rate_pct: 95.3, mfi_count: 82 },
  kenya: { borrowers_million: 4.8, avg_loan_usd: 245, portfolio_billion_usd: 5.1, repayment_rate_pct: 94.8, mfi_count: 67 },
  cambodia: { borrowers_million: 2.9, avg_loan_usd: 4120, portfolio_billion_usd: 12.0, repayment_rate_pct: 97.8, mfi_count: 35 },
}
const getCountryStats = sg.wrap(async (args: { country: string }) => {
  if (!args.country) throw new Error("country is required")
  const d = countries[args.country.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(countries).join(", ")}`)
  return { country: args.country, ...d }
}, { method: "get_country_stats" })
const getGlobalOverview = sg.wrap(async (_args: Record<string, never>) => {
  return { total_borrowers_million: 140, total_portfolio_billion_usd: 185, avg_repayment_rate_pct: 96.5, mfi_count_global: 10000, women_borrowers_pct: 80, countries_served: 100 }
}, { method: "get_global_overview" })
export { getCountryStats, getGlobalOverview }
console.log("settlegrid-microfinance MCP server ready | 2c/call | Powered by SettleGrid")
