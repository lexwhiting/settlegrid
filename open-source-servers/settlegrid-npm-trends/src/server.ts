/**
 * settlegrid-npm-trends — npm Download Trends MCP Server
 *
 * Query npm download statistics for any package. No API key needed.
 *
 * Methods:
 *   get_npm_downloads(package, period?) — Package download counts (1¢)
 *   compare_npm_packages(packages) — Compare download trends (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DownloadInput { package: string; period?: string }
interface CompareInput { packages: string[] }

const API = 'https://api.npmjs.org/downloads'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'npm-trends',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_npm_downloads: { costCents: 1, displayName: 'npm Downloads' },
      compare_npm_packages: { costCents: 2, displayName: 'Compare npm Packages' },
    },
  },
})

const getNpmDownloads = sg.wrap(async (args: DownloadInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const period = args.period || 'last-month'
  const [point, range] = await Promise.all([
    apiFetch<any>(`${API}/point/${period}/${encodeURIComponent(pkg)}`),
    apiFetch<any>(`${API}/range/${period}/${encodeURIComponent(pkg)}`),
  ])
  return {
    package: pkg,
    period,
    total: point.downloads,
    start: point.start,
    end: point.end,
    daily: range.downloads?.slice(-30) ?? [],
  }
}, { method: 'get_npm_downloads' })

const compareNpmPackages = sg.wrap(async (args: CompareInput) => {
  const pkgs = args.packages
  if (!Array.isArray(pkgs) || pkgs.length < 2) throw new Error('At least 2 packages required')
  if (pkgs.length > 10) throw new Error('Maximum 10 packages')
  const results = await Promise.all(
    pkgs.map(async (pkg) => {
      const data = await apiFetch<any>(`${API}/point/last-month/${encodeURIComponent(pkg.trim())}`)
      return { package: pkg.trim(), downloads: data.downloads, start: data.start, end: data.end }
    })
  )
  results.sort((a, b) => b.downloads - a.downloads)
  return { comparison: results, period: 'last-month' }
}, { method: 'compare_npm_packages' })

export { getNpmDownloads, compareNpmPackages }

console.log('settlegrid-npm-trends MCP server ready')
console.log('Methods: get_npm_downloads, compare_npm_packages')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
