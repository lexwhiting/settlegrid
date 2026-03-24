import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "chem-elements", pricing: { defaultCostCents: 1, methods: {
  get_element: { costCents: 1, displayName: "Get Element" },
  search_elements: { costCents: 1, displayName: "Search Elements" },
}}})
interface Element { number: number; symbol: string; name: string; mass: number; category: string; period: number; group: number; density: number; melting_c: number | null; boiling_c: number | null }
const elements: Element[] = [
  { number: 1, symbol: "H", name: "Hydrogen", mass: 1.008, category: "nonmetal", period: 1, group: 1, density: 0.00009, melting_c: -259.16, boiling_c: -252.87 },
  { number: 2, symbol: "He", name: "Helium", mass: 4.003, category: "noble gas", period: 1, group: 18, density: 0.000179, melting_c: -272.2, boiling_c: -268.93 },
  { number: 6, symbol: "C", name: "Carbon", mass: 12.011, category: "nonmetal", period: 2, group: 14, density: 2.267, melting_c: 3550, boiling_c: 4027 },
  { number: 7, symbol: "N", name: "Nitrogen", mass: 14.007, category: "nonmetal", period: 2, group: 15, density: 0.001251, melting_c: -210.0, boiling_c: -195.79 },
  { number: 8, symbol: "O", name: "Oxygen", mass: 15.999, category: "nonmetal", period: 2, group: 16, density: 0.001429, melting_c: -218.79, boiling_c: -182.96 },
  { number: 26, symbol: "Fe", name: "Iron", mass: 55.845, category: "transition metal", period: 4, group: 8, density: 7.874, melting_c: 1538, boiling_c: 2862 },
  { number: 29, symbol: "Cu", name: "Copper", mass: 63.546, category: "transition metal", period: 4, group: 11, density: 8.96, melting_c: 1085, boiling_c: 2562 },
  { number: 47, symbol: "Ag", name: "Silver", mass: 107.868, category: "transition metal", period: 5, group: 11, density: 10.49, melting_c: 961.8, boiling_c: 2162 },
  { number: 79, symbol: "Au", name: "Gold", mass: 196.967, category: "transition metal", period: 6, group: 11, density: 19.3, melting_c: 1064.18, boiling_c: 2856 },
  { number: 92, symbol: "U", name: "Uranium", mass: 238.029, category: "actinide", period: 7, group: 3, density: 19.1, melting_c: 1135, boiling_c: 4131 },
]
const getElement = sg.wrap(async (args: { query: string }) => {
  if (!args.query) throw new Error("query is required (symbol, name, or atomic number)")
  const q = args.query.toLowerCase()
  const el = elements.find(e => e.symbol.toLowerCase() === q || e.name.toLowerCase() === q || e.number === parseInt(q))
  if (!el) throw new Error(`Element not found: ${args.query}`)
  return el
}, { method: "get_element" })
const searchElements = sg.wrap(async (args: { category?: string; min_mass?: number; max_mass?: number }) => {
  let results = [...elements]
  if (args.category) results = results.filter(e => e.category.includes(args.category!.toLowerCase()))
  if (args.min_mass) results = results.filter(e => e.mass >= args.min_mass!)
  if (args.max_mass) results = results.filter(e => e.mass <= args.max_mass!)
  return { count: results.length, elements: results }
}, { method: "search_elements" })
export { getElement, searchElements }
console.log("settlegrid-chem-elements MCP server ready | 1c/call | Powered by SettleGrid")
