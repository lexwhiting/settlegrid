/**
 * build-server-catalog.ts
 *
 * Reads all 1,017 open-source-servers/settlegrid-* directories,
 * extracts metadata from package.json + method counts from server.ts,
 * and writes apps/web/public/server-catalog.json.
 *
 * Run: npx tsx scripts/build-server-catalog.ts
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const SERVERS_DIR = join(ROOT, 'open-source-servers')
const OUTPUT = join(ROOT, 'apps', 'web', 'public', 'server-catalog.json')
const GITHUB_BASE =
  'https://github.com/lexwhiting/settlegrid/tree/main/open-source-servers'

// ── Category mapping from keywords ──────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  weather: ['weather', 'forecast', 'noaa', 'nws', 'climate', 'meteorology'],
  finance: [
    'finance', 'stocks', 'trading', 'forex', 'crypto', 'cryptocurrency',
    'blockchain', 'bitcoin', 'ethereum', 'defi', 'banking', 'payments',
    'market', 'exchange', 'portfolio', 'investment', 'ecommerce',
  ],
  developer: [
    'devtools', 'developer', 'github', 'git', 'npm', 'packages', 'ci',
    'deployment', 'docker', 'kubernetes', 'code', 'programming',
    'debugging', 'testing', 'api', 'sdk', 'webhook',
  ],
  science: [
    'science', 'research', 'nasa', 'space', 'astronomy', 'physics',
    'chemistry', 'biology', 'math', 'statistics', 'academic',
  ],
  security: [
    'security', 'threat', 'malware', 'botnet', 'abuse', 'vulnerability',
    'firewall', 'scan', 'penetration', 'osint', 'forensic',
  ],
  health: [
    'health', 'medical', 'disease', 'drug', 'pharmaceutical', 'clinical',
    'nutrition', 'fitness', 'wellness',
  ],
  government: [
    'government', 'census', 'legislation', 'congress', 'senate',
    'federal', 'municipal', 'regulatory', 'public-data',
  ],
  communication: [
    'communication', 'email', 'sms', 'messaging', 'chat', 'notification',
    'push', 'slack', 'discord', 'telegram',
  ],
  media: [
    'photos', 'photography', 'images', 'video', 'audio', 'music',
    'media', 'podcast', 'streaming', 'entertainment', 'movies', 'tv',
  ],
  gaming: ['gaming', 'game', 'esports', 'steam', 'twitch', 'xbox', 'playstation'],
  education: ['education', 'learning', 'courses', 'university', 'school', 'tutorial'],
  travel: ['travel', 'flight', 'hotel', 'booking', 'tourism', 'airline', 'airport'],
  environment: [
    'environment', 'pollution', 'sustainability', 'energy', 'solar',
    'renewable', 'carbon', 'emissions',
  ],
  iot: ['iot', 'sensor', 'hardware', 'arduino', 'raspberry', 'smart-home'],
  shipping: ['shipping', 'logistics', 'tracking', 'delivery', 'postal', 'freight'],
  text: ['text', 'nlp', 'language', 'translation', 'sentiment', 'extraction'],
  data: [
    'data', 'enrichment', 'ip', 'geolocation', 'geocoding', 'validation',
    'url', 'web', 'scraping', 'parsing',
  ],
}

function classifyCategory(keywords: string[]): string {
  const lower = keywords.map((k) => k.toLowerCase())
  for (const [category, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const term of terms) {
      if (lower.includes(term)) return category
    }
  }
  return 'utility'
}

// ── Method counting ─────────────────────────────────────────────────────────

function countMethods(serverTs: string): number {
  // Pattern 1: sg.wrap(async (...) => ..., { method: 'name' })
  const pattern1 = (serverTs.match(/method:\s*'/g) || []).length

  // Pattern 2: sg.wrap('name', async ...)
  const pattern2 = (serverTs.match(/sg\.wrap\(\s*'/g) || []).length

  // Pattern 3: pricing.methods keys
  const methodsBlock = serverTs.match(/methods:\s*\{([^}]+)\}/s)
  const pattern3 = methodsBlock
    ? (methodsBlock[1].match(/\w+\s*:/g) || []).length
    : 0

  // Use max of pattern1 + pattern2 (they're mutually exclusive patterns)
  // or the pricing.methods count as fallback
  const wrapCount = pattern1 + pattern2
  return Math.max(wrapCount, pattern3, 1)
}

// ── Human-readable name from slug ───────────────────────────────────────────

function slugToName(slug: string): string {
  // Remove "settlegrid-" prefix
  const base = slug.replace(/^settlegrid-/, '')
  // Split on hyphens, capitalize each word, handle acronyms
  return base
    .split('-')
    .map((w) => {
      // Keep known acronyms uppercase
      const upper = w.toUpperCase()
      if (
        ['API', 'IP', 'AI', 'ML', 'NLP', 'SMS', 'URL', 'DNS', 'HTTP',
         'SSH', 'PDF', 'CSV', 'JSON', 'XML', 'RSS', 'IOT', 'SDK',
         'AWS', 'GCP', 'CDN', 'CMS', 'SQL', 'NOAA', 'NWS', 'NASA',
         'USDA', 'FDA', 'EPA', 'FCC', 'SEC', 'USGS', 'NIH', 'CDC',
         'ADSB', 'AIS'].includes(upper)
      ) {
        return upper
      }
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

// ── Main ────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  slug: string
  name: string
  description: string
  category: string
  methods: number
  github: string
}

async function main() {
  const entries = await readdir(SERVERS_DIR, { withFileTypes: true })
  const serverDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('settlegrid-'))
    .map((e) => e.name)
    .sort()

  console.log(`Found ${serverDirs.length} server directories`)

  const catalog: CatalogEntry[] = []
  let skipped = 0

  for (const dir of serverDirs) {
    const pkgPath = join(SERVERS_DIR, dir, 'package.json')
    try {
      const pkgRaw = await readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgRaw) as {
        name?: string
        description?: string
        keywords?: string[]
      }

      // Count methods from server.ts
      let methods = 2 // default
      const serverTsPath = join(SERVERS_DIR, dir, 'src', 'server.ts')
      try {
        const serverTs = await readFile(serverTsPath, 'utf-8')
        methods = countMethods(serverTs)
      } catch {
        // no server.ts, keep default
      }

      const keywords = (pkg.keywords || []).filter(
        (k) => !['settlegrid', 'mcp', 'ai'].includes(k.toLowerCase())
      )

      catalog.push({
        slug: dir,
        name: slugToName(dir),
        description: pkg.description || `MCP server for ${slugToName(dir)}.`,
        category: classifyCategory(pkg.keywords || []),
        methods,
        github: `${GITHUB_BASE}/${dir}`,
      })
    } catch {
      skipped++
    }
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name))

  await writeFile(OUTPUT, JSON.stringify(catalog, null, 2), 'utf-8')
  console.log(`Wrote ${catalog.length} servers to ${OUTPUT}`)
  if (skipped > 0) console.log(`Skipped ${skipped} directories (no package.json)`)

  // Print category summary
  const cats: Record<string, number> = {}
  for (const entry of catalog) {
    cats[entry.category] = (cats[entry.category] || 0) + 1
  }
  console.log('\nCategory breakdown:')
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
