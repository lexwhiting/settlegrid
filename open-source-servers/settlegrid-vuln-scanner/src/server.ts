/**
 * settlegrid-vuln-scanner — Vulnerability Scanner MCP Server
 *
 * Vulnerability Scanner tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface ScanInput { name: string; version?: string; ecosystem?: string }
interface CheckCveInput { cve_id: string }

const sg = settlegrid.init({ toolSlug: 'vuln-scanner', pricing: { defaultCostCents: 3, methods: {
  scan_package: { costCents: 3, displayName: 'Scan Package' },
  check_cve: { costCents: 3, displayName: 'Check CVE' },
  get_advisories: { costCents: 3, displayName: 'Get Recent Advisories' },
}}})

const scanPackage = sg.wrap(async (args: ScanInput) => {
  if (!args.name) throw new Error('package name required')
  const eco = args.ecosystem ?? 'npm'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const body = JSON.stringify({ version: args.version ?? 'latest', package: { name: args.name, ecosystem: eco } })
    const res = await fetch('https://api.osv.dev/v1/query', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body })
    if (!res.ok) throw new Error(`OSV API ${res.status}`)
    const data = await res.json() as { vulns?: Array<{ id: string; summary?: string; published?: string; aliases?: string[]; database_specific?: { severity?: string } }> }
    const vulns = (data.vulns ?? []).slice(0, 10).map(v => ({ id: v.id, summary: v.summary?.slice(0, 200) ?? '', severity: v.database_specific?.severity ?? 'unknown', published: v.published ?? null, aliases: v.aliases?.slice(0, 3) ?? [] }))
    return { package: args.name, version: args.version ?? 'latest', ecosystem: eco, vulnerability_count: vulns.length, vulnerabilities: vulns, scanned_at: new Date().toISOString() }
  } finally { clearTimeout(timeout) }
}, { method: 'scan_package' })

const checkCve = sg.wrap(async (args: CheckCveInput) => {
  if (!args.cve_id) throw new Error('cve_id required (e.g. CVE-2021-44228)')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${args.cve_id}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`OSV API ${res.status}`)
    const v = await res.json() as { id: string; summary?: string; details?: string; published?: string; modified?: string; aliases?: string[]; affected?: unknown[] }
    return { id: v.id, summary: v.summary ?? null, details: v.details?.slice(0, 500) ?? null, published: v.published, modified: v.modified, aliases: v.aliases ?? [], affected_packages: v.affected?.length ?? 0 }
  } finally { clearTimeout(timeout) }
}, { method: 'check_cve' })

const getAdvisories = sg.wrap(async (args: { ecosystem?: string }) => {
  const eco = args.ecosystem ?? 'npm'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const body = JSON.stringify({ package: { ecosystem: eco } })
    const res = await fetch('https://api.osv.dev/v1/query', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body })
    if (!res.ok) throw new Error(`OSV API ${res.status}`)
    const data = await res.json() as { vulns?: Array<{ id: string; summary?: string; published?: string }> }
    return { ecosystem: eco, advisories: (data.vulns ?? []).slice(0, 10).map(v => ({ id: v.id, summary: v.summary?.slice(0, 150) ?? '', published: v.published })), count: Math.min(data.vulns?.length ?? 0, 10) }
  } finally { clearTimeout(timeout) }
}, { method: 'get_advisories' })

export { scanPackage, checkCve, getAdvisories }
console.log('settlegrid-vuln-scanner MCP server ready | Powered by SettleGrid')
