import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "geology-data", pricing: { defaultCostCents: 2, methods: {
  get_rock_type: { costCents: 2, displayName: "Get Rock Type" },
  get_mineral: { costCents: 2, displayName: "Get Mineral" },
}}})
const rocks: Record<string, { type: string; formation: string; hardness: string; common_minerals: string[] }> = {
  granite: { type: "igneous (intrusive)", formation: "slow cooling of magma", hardness: "6-7 Mohs", common_minerals: ["quartz", "feldspar", "mica"] },
  basalt: { type: "igneous (extrusive)", formation: "rapid cooling of lava", hardness: "6 Mohs", common_minerals: ["plagioclase", "pyroxene", "olivine"] },
  limestone: { type: "sedimentary", formation: "marine organism accumulation", hardness: "3-4 Mohs", common_minerals: ["calcite", "aragonite"] },
  marble: { type: "metamorphic", formation: "limestone metamorphism", hardness: "3-5 Mohs", common_minerals: ["calcite", "dolomite"] },
  sandstone: { type: "sedimentary", formation: "sand grain cementation", hardness: "6-7 Mohs", common_minerals: ["quartz", "feldspar"] },
  slate: { type: "metamorphic", formation: "shale metamorphism", hardness: "2.5-4 Mohs", common_minerals: ["mica", "chlorite", "quartz"] },
  obsidian: { type: "igneous (volcanic glass)", formation: "rapid lava cooling", hardness: "5-5.5 Mohs", common_minerals: ["silica-rich glass"] },
}
const getRockType = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const r = rocks[args.name.toLowerCase()]
  if (!r) throw new Error(`Unknown rock. Available: ${Object.keys(rocks).join(", ")}`)
  return { rock: args.name, ...r }
}, { method: "get_rock_type" })
const minerals: Record<string, { hardness: number; formula: string; crystal_system: string; color: string; uses: string[] }> = {
  quartz: { hardness: 7, formula: "SiO₂", crystal_system: "hexagonal", color: "colorless/various", uses: ["electronics", "glass", "jewelry"] },
  diamond: { hardness: 10, formula: "C", crystal_system: "cubic", color: "colorless", uses: ["cutting tools", "jewelry", "optics"] },
  feldspar: { hardness: 6, formula: "KAlSi₃O₈", crystal_system: "monoclinic", color: "white/pink", uses: ["ceramics", "glass"] },
  calcite: { hardness: 3, formula: "CaCO₃", crystal_system: "trigonal", color: "white/clear", uses: ["cement", "optics"] },
  mica: { hardness: 2.5, formula: "KAl₂(Si₃Al)O₁₀(OH)₂", crystal_system: "monoclinic", color: "silver/brown", uses: ["insulation", "cosmetics"] },
}
const getMineral = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const m = minerals[args.name.toLowerCase()]
  if (!m) throw new Error(`Unknown mineral. Available: ${Object.keys(minerals).join(", ")}`)
  return { mineral: args.name, ...m }
}, { method: "get_mineral" })
export { getRockType, getMineral }
console.log("settlegrid-geology-data MCP server ready | 2c/call | Powered by SettleGrid")
