/**
 * settlegrid-snyk-advisor — Package Security Scores MCP Server
 *
 * Query package health scores from Snyk Advisor. No API key needed.
 *
 * Methods:
 *   get_package_score(package, ecosystem?) — Package health score (1¢)
 *   get_package_vulnerabilities(package) — Known vulnerabilities (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ScoreInput { package: string; ecosystem?: string }
interface VulnInput { package: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'settlegrid-snyk-advisor/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'snyk-advisor',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_package_score: { costCents: 1, displayName: 'Package Score' },
      get_package_vulnerabilities: { costCents: 2, displayName: 'Package Vulnerabilities' },
    },
  },
})

const getPackageScore = sg.wrap(async (args: ScoreInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const eco = args.ecosystem || 'npm'
  const data = await apiFetch<any>(
    `https://snyk.io/advisor/${eco}-package/${encodeURIComponent(pkg)}/badge.json`
  )
  const npmData = await apiFetch<any>(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`)
  const latest = npmData['dist-tags']?.latest
  const versionInfo = latest ? npmData.versions?.[latest] : null
  return {
    package: pkg,
    ecosystem: eco,
    score: data.score ?? null,
    label: data.label ?? null,
    latest: latest ?? null,
    license: versionInfo?.license ?? null,
    homepage: npmData.homepage ?? null,
    repository: npmData.repository?.url ?? null,
    description: npmData.description ?? null,
  }
}, { method: 'get_package_score' })

const getPackageVulnerabilities = sg.wrap(async (args: VulnInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const data = await apiFetch<any>(
    `https://registry.npmjs.org/-/v1/security/advisories?search=${encodeURIComponent(pkg)}&page=0&perPage=20`
  ).catch(() => ({ objects: [] }))
  const advisories = (data.objects || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    severity: a.severity,
    module: a.module_name,
    vulnerable_versions: a.vulnerable_versions,
    patched_versions: a.patched_versions,
    overview: a.overview?.slice(0, 300),
  }))
  return { package: pkg, count: advisories.length, advisories }
}, { method: 'get_package_vulnerabilities' })

export { getPackageScore, getPackageVulnerabilities }

console.log('settlegrid-snyk-advisor MCP server ready')
console.log('Methods: get_package_score, get_package_vulnerabilities')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
