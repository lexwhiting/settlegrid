import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "scholarship-db", pricing: { defaultCostCents: 2, methods: {
  search_scholarships: { costCents: 2, displayName: "Search Scholarships" },
  get_scholarship: { costCents: 2, displayName: "Get Scholarship Details" },
}}})
const scholarships = [
  { id: "fulbright", name: "Fulbright Program", country: "US", amount: "Full funding", level: "Graduate", deadline: "October", fields: "All fields", citizenship: "Non-US" },
  { id: "rhodes", name: "Rhodes Scholarship", country: "UK (Oxford)", amount: "Full funding", level: "Graduate", deadline: "October", fields: "All fields", citizenship: "Select countries" },
  { id: "chevening", name: "Chevening Scholarships", country: "UK", amount: "Full funding", level: "Masters", deadline: "November", fields: "All fields", citizenship: "Non-UK" },
  { id: "erasmus", name: "Erasmus Mundus", country: "EU", amount: "Full funding", level: "Masters", deadline: "January", fields: "Select programs", citizenship: "Global" },
  { id: "daad", name: "DAAD Scholarships", country: "Germany", amount: "850-1200 EUR/month", level: "Graduate/PhD", deadline: "Varies", fields: "All fields", citizenship: "Non-German" },
  { id: "gates_cambridge", name: "Gates Cambridge", country: "UK (Cambridge)", amount: "Full funding", level: "Graduate", deadline: "December", fields: "All fields", citizenship: "Non-UK" },
  { id: "schwarzman", name: "Schwarzman Scholars", country: "China (Tsinghua)", amount: "Full funding", level: "Masters", deadline: "September", fields: "Global Affairs, Econ, Public Policy", citizenship: "Global" },
  { id: "mext", name: "MEXT Scholarship", country: "Japan", amount: "Full funding", level: "UG/Graduate", deadline: "April", fields: "All fields", citizenship: "Non-Japanese" },
]
const searchScholarships = sg.wrap(async (args: { country?: string; level?: string; field?: string }) => {
  let results = [...scholarships]
  if (args.country) results = results.filter(s => s.country.toLowerCase().includes(args.country!.toLowerCase()))
  if (args.level) results = results.filter(s => s.level.toLowerCase().includes(args.level!.toLowerCase()))
  return { count: results.length, scholarships: results }
}, { method: "search_scholarships" })
const getScholarship = sg.wrap(async (args: { id: string }) => {
  if (!args.id) throw new Error("id is required")
  const s = scholarships.find(s => s.id === args.id.toLowerCase())
  if (!s) throw new Error(`Unknown. Available IDs: ${scholarships.map(s => s.id).join(", ")}`)
  return s
}, { method: "get_scholarship" })
export { searchScholarships, getScholarship }
console.log("settlegrid-scholarship-db MCP server ready | 2c/call | Powered by SettleGrid")
