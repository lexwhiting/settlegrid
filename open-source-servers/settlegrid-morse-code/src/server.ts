import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "morse-code", pricing: { defaultCostCents: 1, methods: { encode: { costCents: 1, displayName: "Text to Morse" }, decode: { costCents: 1, displayName: "Morse to Text" } } } })
const morseMap: Record<string, string> = { A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",0:"-----",1:".----",2:"..---",3:"...--",4:"....-",5:".....",6:"-....",7:"--...",8:"---..",9:"----." }
const reverseMorse: Record<string, string> = {}; Object.entries(morseMap).forEach(([k, v]) => reverseMorse[v] = k)
const encode = sg.wrap(async (args: { text: string }) => { if (!args.text) throw new Error("text required"); const morse = args.text.toUpperCase().split("").map(c => c === " " ? "/" : morseMap[c] ?? c).join(" "); return { text: args.text, morse, wpm_at_standard: Math.round(args.text.length * 60 / (morse.length * 0.12)) } }, { method: "encode" })
const decode = sg.wrap(async (args: { morse: string }) => { if (!args.morse) throw new Error("morse required"); const text = args.morse.split(" ").map(c => c === "/" ? " " : reverseMorse[c] ?? "?").join(""); return { morse: args.morse, text } }, { method: "decode" })
export { encode, decode }
console.log("settlegrid-morse-code MCP server ready | 1c/call | Powered by SettleGrid")
