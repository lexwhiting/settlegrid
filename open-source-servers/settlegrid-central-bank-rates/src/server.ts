import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "central-bank-rates", pricing: { defaultCostCents: 1, methods: {
  get_rate: { costCents: 1, displayName: "Get Rate" },
  get_all_rates: { costCents: 1, displayName: "Get All Rates" },
}}})
const rates: Record<string, { rate_pct: number; bank: string; last_change: string; direction: string; currency: string }> = {
  us: { rate_pct: 5.50, bank: "Federal Reserve", last_change: "2023-07-26", direction: "hold", currency: "USD" },
  eu: { rate_pct: 4.50, bank: "European Central Bank", last_change: "2023-09-14", direction: "hold", currency: "EUR" },
  uk: { rate_pct: 5.25, bank: "Bank of England", last_change: "2023-08-03", direction: "hold", currency: "GBP" },
  japan: { rate_pct: 0.10, bank: "Bank of Japan", last_change: "2024-03-19", direction: "hike", currency: "JPY" },
  china: { rate_pct: 3.45, bank: "People's Bank of China", last_change: "2023-08-21", direction: "cut", currency: "CNY" },
  brazil: { rate_pct: 10.75, bank: "Banco Central do Brasil", last_change: "2024-03-20", direction: "cut", currency: "BRL" },
  india: { rate_pct: 6.50, bank: "Reserve Bank of India", last_change: "2023-02-08", direction: "hold", currency: "INR" },
  australia: { rate_pct: 4.35, bank: "Reserve Bank of Australia", last_change: "2023-11-07", direction: "hold", currency: "AUD" },
  canada: { rate_pct: 5.00, bank: "Bank of Canada", last_change: "2023-07-12", direction: "hold", currency: "CAD" },
  switzerland: { rate_pct: 1.50, bank: "Swiss National Bank", last_change: "2024-03-21", direction: "cut", currency: "CHF" },
  turkey: { rate_pct: 45.00, bank: "CBRT", last_change: "2024-01-25", direction: "hike", currency: "TRY" },
  argentina: { rate_pct: 80.00, bank: "BCRA", last_change: "2024-03-11", direction: "cut", currency: "ARS" },
}
const getRate = sg.wrap(async (args: { country: string }) => {
  if (!args.country) throw new Error("country is required")
  const r = rates[args.country.toLowerCase()]
  if (!r) throw new Error(`Unknown. Available: ${Object.keys(rates).join(", ")}`)
  return { country: args.country, ...r }
}, { method: "get_rate" })
const getAllRates = sg.wrap(async (_args: Record<string, never>) => {
  return { count: Object.keys(rates).length, rates: Object.entries(rates).map(([k, v]) => ({ country: k, ...v })) }
}, { method: "get_all_rates" })
export { getRate, getAllRates }
console.log("settlegrid-central-bank-rates MCP server ready | 1c/call | Powered by SettleGrid")
