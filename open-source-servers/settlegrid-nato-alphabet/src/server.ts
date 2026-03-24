import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "nato-alphabet", pricing: { defaultCostCents: 1, methods: { spell_out: { costCents: 1, displayName: "Spell Out" }, decode: { costCents: 1, displayName: "Decode NATO" } } } })
const nato: Record<string, string> = { A:"Alpha",B:"Bravo",C:"Charlie",D:"Delta",E:"Echo",F:"Foxtrot",G:"Golf",H:"Hotel",I:"India",J:"Juliet",K:"Kilo",L:"Lima",M:"Mike",N:"November",O:"Oscar",P:"Papa",Q:"Quebec",R:"Romeo",S:"Sierra",T:"Tango",U:"Uniform",V:"Victor",W:"Whiskey",X:"X-ray",Y:"Yankee",Z:"Zulu","0":"Zero","1":"One","2":"Two","3":"Three","4":"Four","5":"Five","6":"Six","7":"Seven","8":"Eight","9":"Niner" }
const reverseNato: Record<string, string> = {}; Object.entries(nato).forEach(([k, v]) => reverseNato[v.toLowerCase()] = k)
const spellOut = sg.wrap(async (args: { text: string }) => { if (!args.text) throw new Error("text required"); const spelled = args.text.toUpperCase().split("").map(c => c === " " ? "(space)" : nato[c] ?? c); return { text: args.text, nato: spelled, phonetic: spelled.join(" ") } }, { method: "spell_out" })
const decode = sg.wrap(async (args: { nato: string }) => { if (!args.nato) throw new Error("nato string required (space-separated)"); const words = args.nato.split(/\s+/); const text = words.map(w => w === "(space)" ? " " : reverseNato[w.toLowerCase()] ?? "?").join(""); return { nato: args.nato, text } }, { method: "decode" })
export { spellOut, decode }
console.log("settlegrid-nato-alphabet MCP server ready | 1c/call | Powered by SettleGrid")
