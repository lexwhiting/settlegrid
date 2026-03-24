import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "spectral-lines", pricing: { defaultCostCents: 1, methods: {
  get_spectral_line: { costCents: 1, displayName: "Get Spectral Line" },
  search_spectrum: { costCents: 1, displayName: "Search Spectrum" },
}}})
interface Line { element: string; wavelength_nm: number; series: string; transition: string; color: string }
const lines: Line[] = [
  { element: "Hydrogen", wavelength_nm: 656.3, series: "Balmer", transition: "n=3→2", color: "red" },
  { element: "Hydrogen", wavelength_nm: 486.1, series: "Balmer", transition: "n=4→2", color: "cyan" },
  { element: "Hydrogen", wavelength_nm: 434.0, series: "Balmer", transition: "n=5→2", color: "violet" },
  { element: "Hydrogen", wavelength_nm: 121.6, series: "Lyman", transition: "n=2→1", color: "UV" },
  { element: "Sodium", wavelength_nm: 589.0, series: "D-line", transition: "3p→3s", color: "yellow" },
  { element: "Sodium", wavelength_nm: 589.6, series: "D-line", transition: "3p→3s", color: "yellow" },
  { element: "Helium", wavelength_nm: 587.6, series: "D3", transition: "3d→2p", color: "yellow" },
  { element: "Iron", wavelength_nm: 527.0, series: "Fe I", transition: "multiplet", color: "green" },
  { element: "Calcium", wavelength_nm: 393.4, series: "K-line", transition: "4p→4s", color: "violet" },
  { element: "Calcium", wavelength_nm: 396.8, series: "H-line", transition: "4p→4s", color: "violet" },
  { element: "Oxygen", wavelength_nm: 557.7, series: "forbidden", transition: "¹S→¹D", color: "green (aurora)" },
  { element: "Neon", wavelength_nm: 640.2, series: "Ne I", transition: "3p→3s", color: "red" },
]
const getSpectralLine = sg.wrap(async (args: { element: string }) => {
  if (!args.element) throw new Error("element is required")
  const results = lines.filter(l => l.element.toLowerCase() === args.element.toLowerCase())
  if (results.length === 0) throw new Error(`No lines for ${args.element}. Available: ${[...new Set(lines.map(l => l.element))].join(", ")}`)
  return { element: args.element, count: results.length, lines: results }
}, { method: "get_spectral_line" })
const searchSpectrum = sg.wrap(async (args: { min_nm?: number; max_nm?: number; color?: string }) => {
  let results = [...lines]
  if (args.min_nm) results = results.filter(l => l.wavelength_nm >= args.min_nm!)
  if (args.max_nm) results = results.filter(l => l.wavelength_nm <= args.max_nm!)
  if (args.color) results = results.filter(l => l.color.includes(args.color!.toLowerCase()))
  return { count: results.length, lines: results }
}, { method: "search_spectrum" })
export { getSpectralLine, searchSpectrum }
console.log("settlegrid-spectral-lines MCP server ready | 1c/call | Powered by SettleGrid")
