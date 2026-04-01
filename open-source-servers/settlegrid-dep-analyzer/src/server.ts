/**
 * settlegrid-dep-analyzer — npm Dependency Analyzer MCP Server
 *
 * Analyzes npm package dependencies, checks for outdated versions,
 * and provides package metadata via the npm registry API.
 *
 * Methods:
 *   analyze_deps(package_json)    — Analyze dependency risk          (2c)
 *   check_outdated(package_name)  — Check latest version             (2c)
 *   get_package_info(name)        — Get detailed package info        (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AnalyzeDepsInput { package_json: Record<string, string> }
interface CheckOutdatedInput { package_name: string }
interface GetPackageInfoInput { name: string }

async function npmFetch<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://registry.npmjs.org/${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`npm registry ${res.status}`)
    return res.json() as Promise<T>
  } finally { clearTimeout(timeout) }
}

const sg = settlegrid.init({
  toolSlug: 'dep-analyzer',
  pricing: { defaultCostCents: 2, methods: {
    analyze_deps: { costCents: 2, displayName: 'Analyze Dependencies' },
    check_outdated: { costCents: 2, displayName: 'Check Outdated' },
    get_package_info: { costCents: 2, displayName: 'Get Package Info' },
  }},
})

const analyzeDeps = sg.wrap(async (args: AnalyzeDepsInput) => {
  if (!args.package_json) throw new Error('package_json (dependencies object) is required')
  const deps = Object.entries(args.package_json)
  const semverRegex = /^\^?~?(\d+)\.(\d+)\.(\d+)/
  const analysis = deps.map(([name, version]) => {
    const match = semverRegex.exec(version)
    const major = match ? parseInt(match[1]) : 0
    const pinned = !version.startsWith('^') && !version.startsWith('~')
    const risk = major === 0 ? 'high' : pinned ? 'low' : 'medium'
    return { name, version, major_version: major, pinned, risk }
  })
  return {
    total: deps.length,
    high_risk: analysis.filter(d => d.risk === 'high').length,
    pinned: analysis.filter(d => d.pinned).length,
    unpinned: analysis.filter(d => !d.pinned).length,
    pre_v1: analysis.filter(d => d.major_version === 0).length,
    dependencies: analysis,
  }
}, { method: 'analyze_deps' })

const checkOutdated = sg.wrap(async (args: CheckOutdatedInput) => {
  if (!args.package_name) throw new Error('package_name is required')
  const data = await npmFetch<{
    name: string; version: string; description?: string; license?: string;
    homepage?: string; repository?: { url?: string }
  }>(`${encodeURIComponent(args.package_name)}/latest`)
  return {
    name: data.name,
    latest: data.version,
    description: data.description?.slice(0, 200) ?? null,
    license: data.license ?? null,
    homepage: data.homepage ?? null,
    repository: data.repository?.url ?? null,
  }
}, { method: 'check_outdated' })

const getPackageInfo = sg.wrap(async (args: GetPackageInfoInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await npmFetch<{
    name: string; description?: string; 'dist-tags'?: Record<string, string>;
    time?: Record<string, string>; versions?: Record<string, unknown>;
    license?: string; homepage?: string; keywords?: string[]
    maintainers?: Array<{ name: string }>
  }>(encodeURIComponent(args.name))
  const versions = data.versions ? Object.keys(data.versions) : []
  const created = data.time?.created ?? null
  const modified = data.time?.modified ?? null
  return {
    name: data.name,
    description: data.description?.slice(0, 300) ?? null,
    latest: data['dist-tags']?.latest ?? null,
    version_count: versions.length,
    first_version: versions[0] ?? null,
    created,
    last_modified: modified,
    license: data.license ?? null,
    homepage: data.homepage ?? null,
    keywords: (data.keywords ?? []).slice(0, 10),
    maintainers: (data.maintainers ?? []).map(m => m.name).slice(0, 5),
  }
}, { method: 'get_package_info' })

export { analyzeDeps, checkOutdated, getPackageInfo }
console.log('settlegrid-dep-analyzer MCP server ready')
console.log('Methods: analyze_deps, check_outdated, get_package_info')
console.log('Pricing: 2c per call | Powered by SettleGrid')
