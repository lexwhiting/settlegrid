/**
 * settlegrid-bundlephobia — Package Bundle Size MCP Server
 *
 * Check npm package bundle sizes via Bundlephobia. No API key needed.
 *
 * Methods:
 *   get_bundle_size(package, version?) — Bundle size for a package (1¢)
 *   get_bundle_history(package) — Size history across versions (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SizeInput { package: string; version?: string }
interface HistoryInput { package: string }

const API = 'https://bundlephobia.com/api'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-bundlephobia/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const sg = settlegrid.init({
  toolSlug: 'bundlephobia',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_bundle_size: { costCents: 1, displayName: 'Bundle Size' },
      get_bundle_history: { costCents: 2, displayName: 'Bundle History' },
    },
  },
})

const getBundleSize = sg.wrap(async (args: SizeInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const query = args.version ? `${pkg}@${args.version}` : pkg
  const data = await apiFetch<any>(`${API}/size?package=${encodeURIComponent(query)}&record=true`)
  return {
    name: data.name,
    version: data.version,
    size: data.size,
    sizeFormatted: formatBytes(data.size),
    gzip: data.gzip,
    gzipFormatted: formatBytes(data.gzip),
    dependencyCount: data.dependencyCount,
    hasJSModule: data.hasJSModule,
    hasJSNext: data.hasJSNext,
    hasSideEffects: data.hasSideEffects,
  }
}, { method: 'get_bundle_size' })

const getBundleHistory = sg.wrap(async (args: HistoryInput) => {
  const pkg = args.package?.trim()
  if (!pkg) throw new Error('package name required')
  const data = await apiFetch<any[]>(`${API}/package-history?package=${encodeURIComponent(pkg)}`)
  const entries = Object.entries(data || {}).map(([version, info]: [string, any]) => ({
    version,
    size: info.size,
    sizeFormatted: formatBytes(info.size),
    gzip: info.gzip,
    gzipFormatted: formatBytes(info.gzip),
  }))
  return { package: pkg, versions: entries.slice(-20) }
}, { method: 'get_bundle_history' })

export { getBundleSize, getBundleHistory }

console.log('settlegrid-bundlephobia MCP server ready')
console.log('Methods: get_bundle_size, get_bundle_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
