import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "roman-numerals", pricing: { defaultCostCents: 1, methods: { to_roman: { costCents: 1, displayName: "Number to Roman" }, from_roman: { costCents: 1, displayName: "Roman to Number" } } } })
const vals: [number, string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]
const toRoman = sg.wrap(async (args: { number: number }) => { if (!args.number || args.number < 1 || args.number > 3999) throw new Error("number must be 1-3999"); let n = args.number; let result = ""; for (const [v, s] of vals) { while (n >= v) { result += s; n -= v } }; return { number: args.number, roman: result } }, { method: "to_roman" })
const fromRoman = sg.wrap(async (args: { roman: string }) => { if (!args.roman) throw new Error("roman numeral required"); const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let result = 0; const s = args.roman.toUpperCase(); for (let i = 0; i < s.length; i++) { const curr = map[s[i]]; const next = map[s[i + 1]]; if (next && curr < next) { result -= curr } else { result += curr } }; return { roman: args.roman, number: result } }, { method: "from_roman" })
export { toRoman, fromRoman }
console.log("settlegrid-roman-numerals MCP server ready | 1c/call | Powered by SettleGrid")
