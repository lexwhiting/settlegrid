import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "license-audit", pricing: { defaultCostCents: 1, methods: {
  check_license: { costCents: 1, displayName: "Check License" },
  check_compatibility: { costCents: 1, displayName: "Check Compatibility" },
}}})
const licenses: Record<string, { spdx: string; type: string; copyleft: boolean; commercial_ok: boolean; patent_grant: boolean; notice_required: boolean }> = {
  mit: { spdx: "MIT", type: "permissive", copyleft: false, commercial_ok: true, patent_grant: false, notice_required: true },
  apache2: { spdx: "Apache-2.0", type: "permissive", copyleft: false, commercial_ok: true, patent_grant: true, notice_required: true },
  gpl3: { spdx: "GPL-3.0", type: "copyleft", copyleft: true, commercial_ok: true, patent_grant: true, notice_required: true },
  lgpl3: { spdx: "LGPL-3.0", type: "weak copyleft", copyleft: true, commercial_ok: true, patent_grant: true, notice_required: true },
  bsd2: { spdx: "BSD-2-Clause", type: "permissive", copyleft: false, commercial_ok: true, patent_grant: false, notice_required: true },
  bsd3: { spdx: "BSD-3-Clause", type: "permissive", copyleft: false, commercial_ok: true, patent_grant: false, notice_required: true },
  mpl2: { spdx: "MPL-2.0", type: "weak copyleft", copyleft: true, commercial_ok: true, patent_grant: true, notice_required: true },
  isc: { spdx: "ISC", type: "permissive", copyleft: false, commercial_ok: true, patent_grant: false, notice_required: true },
  unlicense: { spdx: "Unlicense", type: "public domain", copyleft: false, commercial_ok: true, patent_grant: false, notice_required: false },
  agpl3: { spdx: "AGPL-3.0", type: "strong copyleft", copyleft: true, commercial_ok: true, patent_grant: true, notice_required: true },
}
const checkLicense = sg.wrap(async (args: { license: string }) => {
  if (!args.license) throw new Error("license is required")
  const key = args.license.toLowerCase().replace(/[-._ ]/g, "")
  const l = licenses[key]
  if (!l) throw new Error(`Unknown license. Available: ${Object.keys(licenses).join(", ")}`)
  return l
}, { method: "check_license" })
const checkCompatibility = sg.wrap(async (args: { project_license: string; dependency_license: string }) => {
  if (!args.project_license || !args.dependency_license) throw new Error("Both project_license and dependency_license required")
  const proj = args.project_license.toLowerCase().replace(/[-._ ]/g, "")
  const dep = args.dependency_license.toLowerCase().replace(/[-._ ]/g, "")
  const pLic = licenses[proj]
  const dLic = licenses[dep]
  if (!pLic || !dLic) throw new Error("Unknown license(s)")
  const compatible = !dLic.copyleft || (dLic.copyleft && pLic.copyleft)
  return { project: pLic.spdx, dependency: dLic.spdx, compatible, risk: compatible ? "low" : "high", note: compatible ? "Compatible" : "Copyleft dependency may require your project to use same license" }
}, { method: "check_compatibility" })
export { checkLicense, checkCompatibility }
console.log("settlegrid-license-audit MCP server ready | 1c/call | Powered by SettleGrid")
