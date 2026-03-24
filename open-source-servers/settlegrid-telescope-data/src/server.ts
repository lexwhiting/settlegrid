import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "telescope-data", pricing: { defaultCostCents: 2, methods: {
  get_telescope: { costCents: 2, displayName: "Get Telescope" },
  list_telescopes: { costCents: 2, displayName: "List Telescopes" },
}}})
const telescopes: Record<string, { name: string; type: string; aperture_m: number; location: string; altitude_m: number; first_light: number; wavelengths: string[]; status: string }> = {
  jwst: { name: "James Webb Space Telescope", type: "infrared reflector", aperture_m: 6.5, location: "L2 Lagrange point", altitude_m: -1, first_light: 2022, wavelengths: ["near-IR", "mid-IR"], status: "operational" },
  hubble: { name: "Hubble Space Telescope", type: "reflecting", aperture_m: 2.4, location: "LEO (540 km)", altitude_m: -1, first_light: 1990, wavelengths: ["UV", "visible", "near-IR"], status: "operational" },
  vlt: { name: "Very Large Telescope", type: "reflecting (4 units)", aperture_m: 8.2, location: "Cerro Paranal, Chile", altitude_m: 2635, first_light: 1998, wavelengths: ["UV", "visible", "IR"], status: "operational" },
  keck: { name: "W. M. Keck Observatory", type: "segmented reflector", aperture_m: 10.0, location: "Mauna Kea, Hawaii", altitude_m: 4145, first_light: 1993, wavelengths: ["visible", "near-IR"], status: "operational" },
  alma: { name: "ALMA", type: "radio interferometer", aperture_m: 12.0, location: "Atacama, Chile", altitude_m: 5058, first_light: 2011, wavelengths: ["millimeter", "submillimeter"], status: "operational" },
  elt: { name: "Extremely Large Telescope", type: "segmented reflector", aperture_m: 39.3, location: "Cerro Armazones, Chile", altitude_m: 3046, first_light: 2028, wavelengths: ["visible", "near-IR", "mid-IR"], status: "under construction" },
  fast: { name: "FAST", type: "radio", aperture_m: 500, location: "Guizhou, China", altitude_m: 835, first_light: 2016, wavelengths: ["radio"], status: "operational" },
  chandra: { name: "Chandra X-ray Observatory", type: "X-ray", aperture_m: 1.2, location: "HEO", altitude_m: -1, first_light: 1999, wavelengths: ["X-ray"], status: "operational" },
}
const getTelescope = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const t = telescopes[args.name.toLowerCase().replace(/[- ]/g, "_")]
  if (!t) throw new Error(`Unknown telescope. Available: ${Object.keys(telescopes).join(", ")}`)
  return t
}, { method: "get_telescope" })
const listTelescopes = sg.wrap(async (args: { type?: string }) => {
  let results = Object.values(telescopes)
  if (args.type) results = results.filter(t => t.type.includes(args.type!.toLowerCase()))
  return { count: results.length, telescopes: results }
}, { method: "list_telescopes" })
export { getTelescope, listTelescopes }
console.log("settlegrid-telescope-data MCP server ready | 2c/call | Powered by SettleGrid")
