/**
 * settlegrid-vt-hash-check — VirusTotal Hash Check MCP Server
 *
 * Wraps VirusTotal API with SettleGrid billing.
 * Free key from https://www.virustotal.com/.
 *
 * Methods:
 *   check_file_hash(hash) — check hash (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HashInput { hash: string }

const API_BASE = 'https://www.virustotal.com/api/v3'
const API_KEY = process.env.VIRUSTOTAL_API_KEY || ''

const sg = settlegrid.init({
  toolSlug: 'vt-hash-check',
  pricing: { defaultCostCents: 3, methods: { check_file_hash: { costCents: 3, displayName: 'Check File Hash' } } },
})

const checkFileHash = sg.wrap(async (args: HashInput) => {
  if (!args.hash) throw new Error('hash is required')
  if (!API_KEY) throw new Error('VIRUSTOTAL_API_KEY not set')
  const res = await fetch(`${API_BASE}/files/${args.hash}`, {
    headers: { 'x-apikey': API_KEY },
  })
  if (!res.ok) {
    if (res.status === 404) return { hash: args.hash, found: false, message: 'Hash not found in VirusTotal' }
    throw new Error(`API ${res.status}`)
  }
  const data = await res.json() as any
  const attrs = data.data?.attributes
  return {
    hash: args.hash, found: true,
    sha256: attrs?.sha256, md5: attrs?.md5, sha1: attrs?.sha1,
    file_type: attrs?.type_description, size: attrs?.size,
    detection_stats: attrs?.last_analysis_stats,
    malicious: attrs?.last_analysis_stats?.malicious || 0,
    undetected: attrs?.last_analysis_stats?.undetected || 0,
    reputation: attrs?.reputation,
    names: attrs?.names?.slice(0, 5),
    first_submission: attrs?.first_submission_date,
    last_analysis: attrs?.last_analysis_date,
    tags: attrs?.tags?.slice(0, 10),
  }
}, { method: 'check_file_hash' })

export { checkFileHash }

console.log('settlegrid-vt-hash-check MCP server ready')
console.log('Methods: check_file_hash')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
