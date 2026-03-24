import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "semver-tools", pricing: { defaultCostCents: 1, methods: {
  parse: { costCents: 1, displayName: "Parse Version" },
  compare: { costCents: 1, displayName: "Compare Versions" },
  bump: { costCents: 1, displayName: "Bump Version" },
}}})
function parseSemver(v: string): { major: number; minor: number; patch: number; prerelease: string; build: string } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/.exec(v)
  if (!m) return null
  return { major: parseInt(m[1]), minor: parseInt(m[2]), patch: parseInt(m[3]), prerelease: m[4] ?? "", build: m[5] ?? "" }
}
const parse = sg.wrap(async (args: { version: string }) => {
  if (!args.version) throw new Error("version is required")
  const p = parseSemver(args.version)
  if (!p) throw new Error(`Invalid semver: ${args.version}`)
  return { input: args.version, ...p, valid: true }
}, { method: "parse" })
const compare = sg.wrap(async (args: { version_a: string; version_b: string }) => {
  const a = parseSemver(args.version_a)
  const b = parseSemver(args.version_b)
  if (!a || !b) throw new Error("Both must be valid semver")
  const cmp = a.major !== b.major ? a.major - b.major : a.minor !== b.minor ? a.minor - b.minor : a.patch - b.patch
  return { version_a: args.version_a, version_b: args.version_b, result: cmp > 0 ? "greater" : cmp < 0 ? "less" : "equal", difference: cmp > 0 ? "a > b" : cmp < 0 ? "a < b" : "a == b" }
}, { method: "compare" })
const bump = sg.wrap(async (args: { version: string; type: string }) => {
  const p = parseSemver(args.version)
  if (!p) throw new Error("Invalid semver")
  const t = args.type?.toLowerCase()
  if (t === "major") return { old: args.version, new: `${p.major + 1}.0.0`, type: "major" }
  if (t === "minor") return { old: args.version, new: `${p.major}.${p.minor + 1}.0`, type: "minor" }
  if (t === "patch") return { old: args.version, new: `${p.major}.${p.minor}.${p.patch + 1}`, type: "patch" }
  throw new Error("type must be major, minor, or patch")
}, { method: "bump" })
export { parse, compare, bump }
console.log("settlegrid-semver-tools MCP server ready | 1c/call | Powered by SettleGrid")
