import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "emoji-search", pricing: { defaultCostCents: 1, methods: { search: { costCents: 1, displayName: "Search Emoji" }, get_info: { costCents: 1, displayName: "Get Emoji Info" } } } })
const emojis: Array<{ emoji: string; name: string; category: string; keywords: string[] }> = [
  { emoji: "\uD83D\uDE00", name: "grinning face", category: "Smileys", keywords: ["happy","smile","joy"] },
  { emoji: "\u2764\uFE0F", name: "red heart", category: "Smileys", keywords: ["love","heart","romance"] },
  { emoji: "\uD83D\uDE02", name: "face with tears of joy", category: "Smileys", keywords: ["laugh","funny","lol"] },
  { emoji: "\uD83D\uDC4D", name: "thumbs up", category: "People", keywords: ["like","approve","ok"] },
  { emoji: "\uD83D\uDD25", name: "fire", category: "Nature", keywords: ["hot","lit","flame"] },
  { emoji: "\u2728", name: "sparkles", category: "Nature", keywords: ["stars","magic","clean"] },
  { emoji: "\uD83C\uDF89", name: "party popper", category: "Objects", keywords: ["celebration","party","congrats"] },
  { emoji: "\uD83D\uDE80", name: "rocket", category: "Travel", keywords: ["launch","fast","space"] },
  { emoji: "\uD83C\uDF0D", name: "globe europe-africa", category: "Travel", keywords: ["world","earth","globe"] },
  { emoji: "\uD83D\uDCBB", name: "laptop", category: "Objects", keywords: ["computer","work","code"] },
]
const search = sg.wrap(async (args: { query: string }) => { if (!args.query) throw new Error("query required"); const q = args.query.toLowerCase(); const results = emojis.filter(e => e.name.includes(q) || e.keywords.some(k => k.includes(q))); return { query: args.query, count: results.length, emojis: results } }, { method: "search" })
const getInfo = sg.wrap(async (args: { emoji: string }) => { if (!args.emoji) throw new Error("emoji required"); const e = emojis.find(e => e.emoji === args.emoji); if (e) return e; const cp = args.emoji.codePointAt(0)!; return { emoji: args.emoji, codepoint: `U+${cp.toString(16).toUpperCase()}`, category: "unknown" } }, { method: "get_info" })
export { search, getInfo }
console.log("settlegrid-emoji-search MCP server ready | 1c/call | Powered by SettleGrid")
