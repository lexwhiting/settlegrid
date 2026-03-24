import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "first-aid", pricing: { defaultCostCents: 1, methods: {
  get_guide: { costCents: 1, displayName: "Get First Aid Guide" },
  get_emergency_numbers: { costCents: 1, displayName: "Get Emergency Numbers" },
}}})
const guides: Record<string, { severity: string; steps: string[]; do_not: string[]; call_911: boolean }> = {
  choking: { severity: "critical", steps: ["Ask 'Are you choking?'", "Stand behind, wrap arms around waist", "Make a fist above navel", "Give 5 quick upward thrusts", "Repeat until object dislodged"], do_not: ["Do not perform blind finger sweep", "Do not slap back while standing (for adults)"], call_911: true },
  burns: { severity: "varies", steps: ["Remove from heat source", "Cool with running water 10-20 min", "Cover with sterile non-stick bandage", "Take OTC pain relief"], do_not: ["Do not apply ice directly", "Do not break blisters", "Do not apply butter or toothpaste"], call_911: false },
  bleeding: { severity: "varies", steps: ["Apply direct pressure with clean cloth", "Elevate injured area above heart", "Apply pressure bandage", "If soaked through, add more layers"], do_not: ["Do not remove embedded objects", "Do not apply tourniquet unless trained"], call_911: true },
  cpr: { severity: "critical", steps: ["Check responsiveness", "Call 911", "Place heel of hand on center of chest", "Give 30 compressions (2 inches deep, 100-120/min)", "Give 2 rescue breaths", "Continue 30:2 ratio"], do_not: ["Do not delay compressions", "Do not stop until help arrives"], call_911: true },
  fracture: { severity: "serious", steps: ["Immobilize the injured area", "Apply ice wrapped in cloth", "Elevate if possible", "Control any bleeding"], do_not: ["Do not try to realign bone", "Do not move if spine injury suspected"], call_911: true },
}
const getGuide = sg.wrap(async (args: { condition: string }) => {
  if (!args.condition) throw new Error("condition is required")
  const g = guides[args.condition.toLowerCase()]
  if (!g) throw new Error(`Unknown. Available: ${Object.keys(guides).join(", ")}`)
  return { condition: args.condition, ...g, disclaimer: "This is general guidance. Call emergency services for serious injuries." }
}, { method: "get_guide" })
const getEmergencyNumbers = sg.wrap(async (args: { country?: string }) => {
  const numbers: Record<string, { emergency: string; poison_control: string }> = {
    us: { emergency: "911", poison_control: "1-800-222-1222" }, uk: { emergency: "999/112", poison_control: "111" },
    eu: { emergency: "112", poison_control: "Varies by country" }, australia: { emergency: "000", poison_control: "13 11 26" },
    canada: { emergency: "911", poison_control: "1-800-268-9017" }, japan: { emergency: "119", poison_control: "110" },
  }
  const c = args.country?.toLowerCase() ?? "us"
  return { country: c, ...(numbers[c] ?? { emergency: "112 (international)", poison_control: "Contact local directory" }) }
}, { method: "get_emergency_numbers" })
export { getGuide, getEmergencyNumbers }
console.log("settlegrid-first-aid MCP server ready | 1c/call | Powered by SettleGrid")
