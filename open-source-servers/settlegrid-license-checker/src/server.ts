/**
 * settlegrid-license-checker — Open Source License Lookup MCP Server
 *
 * Look up license information for npm packages. No API key needed.
 *
 * Methods:
 *   check_license(package) — Get license info for a package (1¢)
 *   check_licenses_bulk(packages) — Bulk license check (3¢)
 *   classify_license(license) — Classify a license type (free, local)
 */

import { settlegrid } from '@settlegrid/mcp'

interface LicenseInput { package: string }
interface BulkInput { packages: string[] }
interface ClassifyInput { license: string }

const LICENSE_CATEGORIES: Record<string, { category: string; osi: boolean; copyleft: boolean }> = {
  'MIT': { category: 'Permissive', osi: true, copyleft: false },
  'ISC': { category: 'Permissive', osi: true, copyleft: false },
  'BSD-2-Clause': { category: 'Permissive', osi: true, copyleft: false },
  'BSD-3-Clause': { category: 'Permissive', osi: true, copyleft: false },
  'Apache-2.0': { category: 'Permissive', osi: true, copyleft: false },
  'Unlicense': { category: 'Public Domain', osi: true, copyleft: false },
  'CC0-1.0': { category: 'Public Domain', osi: false, copyleft: false },
  'MPL-2.0': { category: 'Weak Copyleft', osi: true, copyleft: true },
  'LGPL-2.1': { category: 'Weak Copyleft', osi: true, copyleft: true },
  'LGPL-3.0': { category: 'Weak Copyleft', osi: true, copyleft: true },
  'GPL-2.0': { category: 'Strong Copyleft', osi: true, copyleft: true },
  'GPL-3.0': { category: 'Strong Copyleft', osi: true, copyleft: true },
  'AGPL-3.0': { category: 'Network Copyleft', osi: true, copyleft: true },
  'SSPL-1.0': { category: 'Source Available', osi: false, copyleft: true },
  'BSL-1.1': { category: 'Source Available', osi: false, copyleft: false },
  'Elastic-2.0': { category: 'Source Available', osi: false, copyleft: false },
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'license-checker',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_license: { costCents: 1, displayName: 'Check License' },
      check_licenses_bulk: { costCents: 3, displayName: 'Bulk License Check' },
      classify_license: { costCents: 0, displayName: 'Classify License' },
    },
  },
})

const checkLicense = sg.wrap(async (args: LicenseInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const data = await apiFetch<any>(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`)
  const latest = data['dist-tags']?.latest
  const info = latest ? data.versions?.[latest] : null
  const license = info?.license || data.license || 'Unknown'
  const classification = LICENSE_CATEGORIES[license] || { category: 'Unknown', osi: false, copyleft: false }
  return { package: pkg, version: latest, license, ...classification, repository: data.repository?.url ?? null }
}, { method: 'check_license' })

const checkLicensesBulk = sg.wrap(async (args: BulkInput) => {
  if (!Array.isArray(args.packages) || args.packages.length === 0) throw new Error('packages array required')
  if (args.packages.length > 50) throw new Error('Maximum 50 packages')
  const results = await Promise.all(
    args.packages.map(async (pkg) => {
      try {
        const data = await apiFetch<any>(`https://registry.npmjs.org/${encodeURIComponent(pkg.trim())}`)
        const latest = data['dist-tags']?.latest
        const info = latest ? data.versions?.[latest] : null
        const license = info?.license || data.license || 'Unknown'
        const cat = LICENSE_CATEGORIES[license] || { category: 'Unknown', osi: false, copyleft: false }
        return { package: pkg.trim(), license, ...cat }
      } catch { return { package: pkg.trim(), license: 'Error', category: 'Unknown', osi: false, copyleft: false } }
    })
  )
  const copyleftCount = results.filter(r => r.copyleft).length
  return { results, summary: { total: results.length, copyleft: copyleftCount, permissive: results.length - copyleftCount } }
}, { method: 'check_licenses_bulk' })

const classifyLicense = sg.wrap(async (args: ClassifyInput) => {
  const lic = args.license?.trim()
  if (!lic) throw new Error('license identifier required')
  const info = LICENSE_CATEGORIES[lic]
  if (!info) return { license: lic, category: 'Unknown', osi: false, copyleft: false, known: false }
  return { license: lic, ...info, known: true }
}, { method: 'classify_license' })

export { checkLicense, checkLicensesBulk, classifyLicense }

console.log('settlegrid-license-checker MCP server ready')
console.log('Methods: check_license, check_licenses_bulk, classify_license')
console.log('Pricing: 0-3¢ per call | Powered by SettleGrid')
