/**
 * settlegrid-bright-data — Bright Data Scrapers Library MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.brightdata.com'

function getApiKey(): string {
  const k = process.env.BRIGHTDATA_API_KEY
  if (!k) throw new Error('BRIGHTDATA_API_KEY environment variable is required')
  return k
}

interface TriggerJobInput {
  scraper_id: string
  inputs: object[]
  endpoint?: string
  notify?: string
  format?: string
}

interface GetJobProgressInput {
  snapshot_id: string
}

interface GetSnapshotResultsInput {
  snapshot_id: string
  format?: string
}

interface ScrapeSyncInput {
  scraper_id: string
  inputs: object[]
  format?: string
}

const sg = settlegrid.init({
  toolSlug: 'bright-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      trigger_scraper_job: { costCents: 5, displayName: 'Trigger Scraper Job' },
      get_job_progress: { costCents: 1, displayName: 'Get Job Progress' },
      get_snapshot_results: { costCents: 2, displayName: 'Get Snapshot Results' },
      scrape_sync: { costCents: 8, displayName: 'Scrape Synchronous' },
    },
  },
})

const triggerScraperJob = sg.wrap(async (args: TriggerJobInput) => {
  const apiKey = getApiKey()
  const scraperId = args.scraper_id?.trim()
  if (!scraperId) throw new Error('scraper_id is required')
  if (!args.inputs || !Array.isArray(args.inputs) || args.inputs.length === 0) {
    throw new Error('inputs must be a non-empty array')
  }
  const clampedInputs = args.inputs.slice(0, 100)
  const params = new URLSearchParams({ id: scraperId })
  if (args.endpoint) params.set('endpoint', args.endpoint)
  if (args.notify) params.set('notify', args.notify)
  if (args.format) params.set('format', args.format)
  const res = await fetch(`${BASE}/datasets/v3/trigger?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-bright-data/1.0',
    },
    body: JSON.stringify(clampedInputs),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Bright Data API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'trigger_scraper_job' })

const getJobProgress = sg.wrap(async (args: GetJobProgressInput) => {
  const apiKey = getApiKey()
  const snapshotId = args.snapshot_id?.trim()
  if (!snapshotId) throw new Error('snapshot_id is required')
  const res = await fetch(`${BASE}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-bright-data/1.0',
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Bright Data API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'get_job_progress' })

const getSnapshotResults = sg.wrap(async (args: GetSnapshotResultsInput) => {
  const apiKey = getApiKey()
  const snapshotId = args.snapshot_id?.trim()
  if (!snapshotId) throw new Error('snapshot_id is required')
  const params = new URLSearchParams()
  if (args.format) params.set('format', args.format)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${BASE}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-bright-data/1.0',
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Bright Data API ${res.status}: ${errText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  const text = await res.text()
  return { data: text, format: args.format || 'json' }
}, { method: 'get_snapshot_results' })

const scrapeSync = sg.wrap(async (args: ScrapeSyncInput) => {
  const apiKey = getApiKey()
  const scraperId = args.scraper_id?.trim()
  if (!scraperId) throw new Error('scraper_id is required')
  if (!args.inputs || !Array.isArray(args.inputs) || args.inputs.length === 0) {
    throw new Error('inputs must be a non-empty array')
  }
  const clampedInputs = args.inputs.slice(0, 50)
  const params = new URLSearchParams({ id: scraperId })
  if (args.format) params.set('format', args.format)
  const res = await fetch(`${BASE}/datasets/v3/scrape?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-bright-data/1.0',
    },
    body: JSON.stringify(clampedInputs),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Bright Data API ${res.status}: ${errText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  const text = await res.text()
  return { data: text, format: args.format || 'json' }
}, { method: 'scrape_sync' })

export { triggerScraperJob, getJobProgress, getSnapshotResults, scrapeSync }
console.log('settlegrid-bright-data MCP server ready')
console.log('Methods: trigger_scraper_job, get_job_progress, get_snapshot_results, scrape_sync')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')