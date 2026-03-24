import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "dep-analyzer", pricing: { defaultCostCents: 2, methods: {
  analyze_deps: { costCents: 2, displayName: "Analyze Dependencies" },
  check_outdated: { costCents: 2, displayName: "Check Outdated" },
}}})
const analyzeDeps = sg.wrap(async (args: { package_json: Record<string, string> }) => {
  if (!args.package_json) throw new Error("package_json (dependencies object) is required")
  const deps = Object.entries(args.package_json)
  const total = deps.length
  const semverRegex = /^\^?\~?(\d+)\.(\d+)\.(\d+)/
  const analysis = deps.map(([name, version]) => {
    const match = semverRegex.exec(version)
    const major = match ? parseInt(match[1]) : 0
    return { name, version, risk: major === 0 ? "high" : "low", pinned: !version.startsWith("^") && !version.startsWith("~") }
  })
  const highRisk = analysis.filter(d => d.risk === "high").length
  return { total, high_risk: highRisk, pinned: analysis.filter(d => d.pinned).length, dependencies: analysis }
}, { method: "analyze_deps" })
const checkOutdated = sg.wrap(async (args: { package_name: string }) => {
  if (!args.package_name) throw new Error("package_name is required")
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(args.package_name)}/latest`)
  if (!res.ok) throw new Error(`npm registry ${res.status}`)
  const data = await res.json()
  return { name: data.name, latest: data.version, description: data.description?.slice(0, 200), license: data.license, homepage: data.homepage }
}, { method: "check_outdated" })
export { analyzeDeps, checkOutdated }
console.log("settlegrid-dep-analyzer MCP server ready | 2c/call | Powered by SettleGrid")
