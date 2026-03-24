import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "uni-rankings", pricing: { defaultCostCents: 2, methods: {
  get_rankings: { costCents: 2, displayName: "Get University Rankings" },
  search_university: { costCents: 2, displayName: "Search University" },
}}})
const universities = [
  { rank: 1, name: "MIT", country: "US", score: 100, students: 11934, intl_pct: 33 },
  { rank: 2, name: "University of Cambridge", country: "UK", score: 99.2, students: 24450, intl_pct: 37 },
  { rank: 3, name: "University of Oxford", country: "UK", score: 98.9, students: 26565, intl_pct: 42 },
  { rank: 4, name: "Harvard University", country: "US", score: 98.3, students: 36012, intl_pct: 25 },
  { rank: 5, name: "Stanford University", country: "US", score: 98.1, students: 17680, intl_pct: 23 },
  { rank: 6, name: "ETH Zurich", country: "CH", score: 97.8, students: 24534, intl_pct: 40 },
  { rank: 7, name: "Caltech", country: "US", score: 97.4, students: 2397, intl_pct: 33 },
  { rank: 8, name: "Imperial College London", country: "UK", score: 97.0, students: 22350, intl_pct: 59 },
  { rank: 9, name: "UCL", country: "UK", score: 96.4, students: 46550, intl_pct: 56 },
  { rank: 10, name: "NUS", country: "SG", score: 95.9, students: 43000, intl_pct: 29 },
  { rank: 11, name: "University of Tokyo", country: "JP", score: 95.2, students: 28753, intl_pct: 14 },
  { rank: 12, name: "Tsinghua University", country: "CN", score: 94.8, students: 53302, intl_pct: 10 },
  { rank: 13, name: "University of Melbourne", country: "AU", score: 94.1, students: 53615, intl_pct: 42 },
  { rank: 14, name: "EPFL", country: "CH", score: 93.7, students: 12866, intl_pct: 60 },
  { rank: 15, name: "Peking University", country: "CN", score: 93.3, students: 47067, intl_pct: 15 },
]
const getRankings = sg.wrap(async (args: { country?: string; limit?: number }) => {
  let results = [...universities]
  if (args.country) results = results.filter(u => u.country.toLowerCase() === args.country!.toLowerCase())
  const limit = Math.min(args.limit ?? 10, 50)
  return { source: "QS World University Rankings 2024", count: Math.min(results.length, limit), rankings: results.slice(0, limit) }
}, { method: "get_rankings" })
const searchUniversity = sg.wrap(async (args: { query: string }) => {
  if (!args.query) throw new Error("query is required")
  const q = args.query.toLowerCase()
  const results = universities.filter(u => u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q))
  return { query: args.query, count: results.length, results }
}, { method: "search_university" })
export { getRankings, searchUniversity }
console.log("settlegrid-uni-rankings MCP server ready | 2c/call | Powered by SettleGrid")
