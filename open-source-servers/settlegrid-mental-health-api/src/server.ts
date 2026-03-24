import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "mental-health-api", pricing: { defaultCostCents: 1, methods: {
  get_resource: { costCents: 1, displayName: "Get Resource" },
  get_hotlines: { costCents: 1, displayName: "Get Crisis Hotlines" },
}}})
const resources: Record<string, { description: string; symptoms: string[]; coping_strategies: string[]; when_to_seek_help: string }> = {
  anxiety: { description: "Persistent excessive worry affecting daily life", symptoms: ["restlessness", "fatigue", "difficulty concentrating", "muscle tension", "sleep problems"], coping_strategies: ["deep breathing (4-7-8)", "progressive muscle relaxation", "grounding (5-4-3-2-1)", "regular exercise", "limit caffeine"], when_to_seek_help: "When anxiety interferes with daily activities for 2+ weeks" },
  depression: { description: "Persistent low mood and loss of interest", symptoms: ["persistent sadness", "loss of interest", "sleep changes", "fatigue", "hopelessness"], coping_strategies: ["behavioral activation", "regular exercise", "social connection", "routine building", "limiting alcohol"], when_to_seek_help: "When symptoms persist for 2+ weeks or include thoughts of self-harm" },
  burnout: { description: "Chronic workplace stress leading to exhaustion", symptoms: ["emotional exhaustion", "cynicism", "reduced efficacy", "physical symptoms", "detachment"], coping_strategies: ["set boundaries", "take breaks", "delegate tasks", "practice self-care", "consider time off"], when_to_seek_help: "When unable to function at work or home" },
  ptsd: { description: "Post-traumatic stress following a traumatic event", symptoms: ["flashbacks", "nightmares", "avoidance", "hypervigilance", "emotional numbness"], coping_strategies: ["grounding techniques", "trauma-informed therapy", "safe environment", "support groups", "mindfulness"], when_to_seek_help: "Immediately if symptoms appear after trauma" },
}
const getResource = sg.wrap(async (args: { topic: string }) => {
  if (!args.topic) throw new Error("topic is required")
  const r = resources[args.topic.toLowerCase()]
  if (!r) throw new Error(`Unknown topic. Available: ${Object.keys(resources).join(", ")}`)
  return { topic: args.topic, ...r, disclaimer: "This is informational only. If in crisis, contact a hotline immediately." }
}, { method: "get_resource" })
const getHotlines = sg.wrap(async (args: { country?: string }) => {
  const hotlines: Record<string, Array<{ name: string; number: string; available: string }>> = {
    us: [{ name: "988 Suicide & Crisis Lifeline", number: "988", available: "24/7" }, { name: "Crisis Text Line", number: "Text HOME to 741741", available: "24/7" }],
    uk: [{ name: "Samaritans", number: "116 123", available: "24/7" }, { name: "Mind", number: "0300 123 3393", available: "Mon-Fri 9am-6pm" }],
    canada: [{ name: "988 Suicide Crisis Helpline", number: "988", available: "24/7" }],
    australia: [{ name: "Lifeline", number: "13 11 14", available: "24/7" }, { name: "Beyond Blue", number: "1300 22 4636", available: "24/7" }],
    international: [{ name: "International Association for Suicide Prevention", number: "https://www.iasp.info/resources/Crisis_Centres/", available: "Varies" }],
  }
  const country = args.country?.toLowerCase() ?? "us"
  const h = hotlines[country] ?? hotlines.international!
  return { country, hotlines: h, note: "If in immediate danger, call local emergency services." }
}, { method: "get_hotlines" })
export { getResource, getHotlines }
console.log("settlegrid-mental-health-api MCP server ready | 1c/call | Powered by SettleGrid")
