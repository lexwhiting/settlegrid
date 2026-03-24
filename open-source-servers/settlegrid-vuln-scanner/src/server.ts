import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "vuln-scanner", pricing: { defaultCostCents: 3, methods: {
  scan_package: { costCents: 3, displayName: "Scan Package" },
  check_cve: { costCents: 3, displayName: "Check CVE" },
}}})
const scanPackage = sg.wrap(async (args: { name: string; version?: string; ecosystem?: string }) => {
  if (!args.name) throw new Error("name is required")
  const eco = args.ecosystem ?? "npm"
  const body: any = { version: args.version ?? "latest", package: { name: args.name, ecosystem: eco } }
  const res = await fetch("https://api.osv.dev/v1/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`OSV API ${res.status}`)
  const data = await res.json()
  const vulns = (data.vulns ?? []).slice(0, 10).map((v: any) => ({ id: v.id, summary: v.summary?.slice(0, 200), severity: v.database_specific?.severity ?? "unknown", published: v.published, aliases: v.aliases?.slice(0, 3) }))
  return { package: args.name, version: args.version ?? "latest", ecosystem: eco, vulnerability_count: vulns.length, vulnerabilities: vulns }
}, { method: "scan_package" })
const checkCve = sg.wrap(async (args: { cve_id: string }) => {
  if (!args.cve_id) throw new Error("cve_id is required (e.g. CVE-2021-44228)")
  const res = await fetch(`https://api.osv.dev/v1/vulns/${args.cve_id}`)
  if (!res.ok) throw new Error(`OSV API ${res.status}`)
  const v = await res.json()
  return { id: v.id, summary: v.summary, details: v.details?.slice(0, 500), published: v.published, modified: v.modified, aliases: v.aliases, affected_count: v.affected?.length ?? 0 }
}, { method: "check_cve" })
export { scanPackage, checkCve }
console.log("settlegrid-vuln-scanner MCP server ready | 3c/call | Powered by SettleGrid")
