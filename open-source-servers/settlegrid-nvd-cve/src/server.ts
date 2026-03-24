/**
 * settlegrid-nvd-cve — NIST NVD CVE MCP Server
 *
 * Wraps NIST NVD API with SettleGrid billing.
 * No API key needed (rate limited without key).
 *
 * Methods:
 *   search_cve(keyword, limit?) — search CVEs (2¢)
 *   get_cve(cve_id) — CVE details (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { keyword: string; limit?: number }
interface CveInput { cve_id: string }

const API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'nvd-cve',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_cve: { costCents: 2, displayName: 'Search CVEs' },
      get_cve: { costCents: 2, displayName: 'Get CVE' },
    },
  },
})

const searchCve = sg.wrap(async (args: SearchInput) => {
  if (!args.keyword) throw new Error('keyword is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`?keywordSearch=${encodeURIComponent(args.keyword)}&resultsPerPage=${limit}`)
  return {
    total: data.totalResults,
    cves: (data.vulnerabilities || []).map((v: any) => {
      const cve = v.cve
      return {
        id: cve.id, published: cve.published, modified: cve.lastModified,
        description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value?.slice(0, 300),
        severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || cve.metrics?.cvssMetricV2?.[0]?.baseSeverity,
        score: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore,
      }
    }),
  }
}, { method: 'search_cve' })

const getCve = sg.wrap(async (args: CveInput) => {
  if (!args.cve_id) throw new Error('cve_id is required')
  const data = await apiFetch<any>(`?cveId=${args.cve_id}`)
  const cve = data.vulnerabilities?.[0]?.cve
  if (!cve) throw new Error('CVE not found')
  return {
    id: cve.id, published: cve.published, modified: cve.lastModified,
    description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value,
    severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity,
    score: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
    vector: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.vectorString,
    references: cve.references?.slice(0, 10).map((r: any) => ({ url: r.url, source: r.source })),
    weaknesses: cve.weaknesses?.map((w: any) => w.description?.[0]?.value),
  }
}, { method: 'get_cve' })

export { searchCve, getCve }

console.log('settlegrid-nvd-cve MCP server ready')
console.log('Methods: search_cve, get_cve')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
